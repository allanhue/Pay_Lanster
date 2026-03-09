package routes

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
)

func (a *App) employeesHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listEmployees(w, r)
	case http.MethodPost:
		a.createEmployee(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) listEmployees(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "orgId is required")
		return
	}

	if a.db != nil {
		rows, err := a.db.Query(
			`SELECT id, org_id, full_name, email, department, salary, pay_cycle, status
       FROM employees
       WHERE org_id = $1
       ORDER BY created_at DESC, id DESC`,
			orgID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load employees")
			return
		}
		defer rows.Close()

		employees := []Employee{}
		for rows.Next() {
			var employee Employee
			if err := rows.Scan(&employee.ID, &employee.OrgID, &employee.FullName, &employee.Email, &employee.Department, &employee.Salary, &employee.PayCycle, &employee.Status); err != nil {
				writeError(w, http.StatusInternalServerError, "could not load employees")
				return
			}
			employees = append(employees, employee)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "could not load employees")
			return
		}

		writeJSON(w, http.StatusOK, employees)
		return
	}

	a.mu.RLock()
	list := append([]Employee(nil), a.employees[orgID]...)
	a.mu.RUnlock()

	writeJSON(w, http.StatusOK, list)
}

func (a *App) createEmployee(w http.ResponseWriter, r *http.Request) {
	var req Employee
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.OrgID == "" || req.FullName == "" || req.Email == "" || req.Department == "" || req.Salary <= 0 {
		writeError(w, http.StatusBadRequest, "missing required employee fields")
		return
	}

	if req.PayCycle == "" {
		req.PayCycle = "monthly"
	}

	if a.db != nil {
		req.ID = a.nextID("emp")
		req.Status = "active"
		if _, err := a.db.Exec(
			`INSERT INTO employees (id, org_id, full_name, email, department, salary, pay_cycle, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			req.ID, req.OrgID, req.FullName, req.Email, req.Department, req.Salary, req.PayCycle, req.Status,
		); err != nil {
			if err == sql.ErrNoRows {
				writeError(w, http.StatusBadRequest, "organization not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "could not save employee")
			return
		}

		writeJSON(w, http.StatusCreated, req)
		return
	}

	a.mu.Lock()
	req.ID = a.nextID("emp")
	req.Status = "active"
	a.employees[req.OrgID] = append(a.employees[req.OrgID], req)
	a.mu.Unlock()

	writeJSON(w, http.StatusCreated, req)
}
