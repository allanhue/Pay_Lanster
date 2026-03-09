package routes

import (
	"database/sql"
	"net/http"
	"strings"
)

func (a *App) orgDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "orgId is required")
		return
	}

	if a.db != nil {
		var total, active int
		var monthlyPayroll, avgSalary sql.NullFloat64
		err := a.db.QueryRow(
			`SELECT
         COUNT(*) AS total_employees,
         COUNT(*) FILTER (WHERE status = 'active') AS active_employees,
         COALESCE(SUM(salary / 12.0), 0) AS monthly_payroll,
         COALESCE(AVG(salary), 0) AS avg_salary
       FROM employees
       WHERE org_id = $1`,
			orgID,
		).Scan(&total, &active, &monthlyPayroll, &avgSalary)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load dashboard")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"totalEmployees":  total,
			"activeEmployees": active,
			"monthlyPayroll":  monthlyPayroll.Float64,
			"avgSalary":       avgSalary.Float64,
		})
		return
	}

	a.mu.RLock()
	list := a.employees[orgID]
	a.mu.RUnlock()

	total := len(list)
	active := 0
	monthlyPayroll := 0.0
	for _, employee := range list {
		if employee.Status == "active" {
			active++
		}
		monthlyPayroll += employee.Salary / 12
	}

	avgSalary := 0.0
	if total > 0 {
		avgSalary = monthlyPayroll * 12 / float64(total)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"totalEmployees":  total,
		"activeEmployees": active,
		"monthlyPayroll":  monthlyPayroll,
		"avgSalary":       avgSalary,
	})
}

func (a *App) systemDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if a.db != nil {
		var tenants, employees int
		var payroll sql.NullFloat64
		err := a.db.QueryRow(
			`SELECT
         (SELECT COUNT(*) FROM organizations),
         (SELECT COUNT(*) FROM employees),
         (SELECT COALESCE(SUM(salary / 12.0), 0) FROM employees)`,
		).Scan(&tenants, &employees, &payroll)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load dashboard")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"tenants":   tenants,
			"employees": employees,
			"payroll":   payroll.Float64,
		})
		return
	}

	a.mu.RLock()
	defer a.mu.RUnlock()

	employees := 0
	payroll := 0.0
	for _, list := range a.employees {
		employees += len(list)
		for _, employee := range list {
			payroll += employee.Salary / 12
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"tenants":   len(a.orgNames),
		"employees": employees,
		"payroll":   payroll,
	})
}

func (a *App) tenantAnalytics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if a.db != nil {
		rows, err := a.db.Query(
			`SELECT
         o.id,
         o.name,
         COUNT(e.id) AS employees,
         COALESCE(SUM(e.salary / 12.0), 0) AS monthly_payroll
       FROM organizations o
       LEFT JOIN employees e ON e.org_id = o.id
       GROUP BY o.id, o.name
       ORDER BY o.created_at DESC, o.id DESC`,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load analytics")
			return
		}
		defer rows.Close()

		stats := []tenantStat{}
		for rows.Next() {
			var stat tenantStat
			if err := rows.Scan(&stat.OrgID, &stat.OrgName, &stat.Employees, &stat.MonthlyPayroll); err != nil {
				writeError(w, http.StatusInternalServerError, "could not load analytics")
				return
			}
			stats = append(stats, stat)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "could not load analytics")
			return
		}

		writeJSON(w, http.StatusOK, stats)
		return
	}

	a.mu.RLock()
	defer a.mu.RUnlock()

	stats := make([]tenantStat, 0, len(a.orgNames))
	for orgID, orgName := range a.orgNames {
		list := a.employees[orgID]
		monthlyPayroll := 0.0
		for _, employee := range list {
			monthlyPayroll += employee.Salary / 12
		}
		stats = append(stats, tenantStat{
			OrgID:          orgID,
			OrgName:        orgName,
			Employees:      len(list),
			MonthlyPayroll: monthlyPayroll,
		})
	}

	writeJSON(w, http.StatusOK, stats)
}
