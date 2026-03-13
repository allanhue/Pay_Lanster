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
	case http.MethodDelete:
		a.deleteEmployee(w, r)
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
			`SELECT id,
         org_id,
         full_name,
         COALESCE(email, ''),
         COALESCE(department, ''),
         salary,
         COALESCE(pay_cycle, ''),
         COALESCE(status, 'active'),
         COALESCE(tax_id, ''),
         COALESCE(nssf, ''),
         COALESCE(nhif, ''),
         COALESCE(paye, ''),
         COALESCE(bank_name, ''),
         COALESCE(bank_account, ''),
         COALESCE(contract_type, ''),
         COALESCE(location, ''),
         COALESCE(TO_CHAR(hire_date, 'YYYY-MM-DD'), '')
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
			if err := rows.Scan(
				&employee.ID,
				&employee.OrgID,
				&employee.FullName,
				&employee.Email,
				&employee.Department,
				&employee.Salary,
				&employee.PayCycle,
				&employee.Status,
				&employee.TaxID,
				&employee.NSSF,
				&employee.NHIF,
				&employee.PAYE,
				&employee.BankName,
				&employee.BankAccount,
				&employee.ContractType,
				&employee.Location,
				&employee.HireDate,
			); err != nil {
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
	if req.Status == "" {
		req.Status = "active"
	}
	if req.ContractType == "" {
		req.ContractType = "full_time"
	}

	if a.db != nil {
		req.ID = a.nextID("emp")
		if _, err := a.db.Exec(
			`INSERT INTO employees (
         id, org_id, full_name, email, department, salary, pay_cycle, status,
         tax_id, nssf, nhif, paye, bank_name, bank_account, contract_type, location, hire_date
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15, $16, NULLIF($17, '')
       )`,
			req.ID,
			req.OrgID,
			req.FullName,
			req.Email,
			req.Department,
			req.Salary,
			req.PayCycle,
			req.Status,
			req.TaxID,
			req.NSSF,
			req.NHIF,
			req.PAYE,
			req.BankName,
			req.BankAccount,
			req.ContractType,
			req.Location,
			req.HireDate,
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
	a.employees[req.OrgID] = append(a.employees[req.OrgID], req)
	a.mu.Unlock()

	writeJSON(w, http.StatusCreated, req)
}

func (a *App) deleteEmployee(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	empID := strings.TrimSpace(r.URL.Query().Get("id"))
	if orgID == "" || empID == "" {
		writeError(w, http.StatusBadRequest, "orgId and id are required")
		return
	}

	if a.db != nil {
		res, err := a.db.Exec(`DELETE FROM employees WHERE id = $1 AND org_id = $2`, empID, orgID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not delete employee")
			return
		}
		if rows, _ := res.RowsAffected(); rows == 0 {
			writeError(w, http.StatusNotFound, "employee not found")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	list := a.employees[orgID]
	next := list[:0]
	found := false
	for _, emp := range list {
		if emp.ID == empID {
			found = true
			continue
		}
		next = append(next, emp)
	}
	a.employees[orgID] = next
	if !found {
		writeError(w, http.StatusNotFound, "employee not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}
