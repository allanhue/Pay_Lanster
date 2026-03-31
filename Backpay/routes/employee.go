package routes

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func normalizeEnum(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	return strings.ToLower(strings.ReplaceAll(trimmed, " ", "_"))
}

func (a *App) employeesHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listEmployees(w, r)
	case http.MethodPost:
		a.createEmployee(w, r)
	case http.MethodPut:
		a.updateEmployee(w, r)
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
         COALESCE(phone, ''),
         COALESCE(title, ''),
         COALESCE(position, ''),
         COALESCE(designation, ''),
         COALESCE(department, ''),
         salary,
         COALESCE(pay_cycle, ''),
         COALESCE(status, 'active'),
         COALESCE(tax_id, ''),
         COALESCE(nssf, ''),
         COALESCE(nhif, ''),
         COALESCE(paye, ''),
         COALESCE(bank_name, ''),
         COALESCE(bank_account_name, ''),
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
			log.Printf("listEmployees query failed orgId=%s err=%v", orgID, err)
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
				&employee.Phone,
				&employee.Title,
				&employee.Position,
				&employee.Designation,
				&employee.Department,
				&employee.Salary,
				&employee.PayCycle,
				&employee.Status,
				&employee.TaxID,
				&employee.NSSF,
				&employee.NHIF,
				&employee.PAYE,
				&employee.BankName,
				&employee.BankAccountName,
				&employee.BankAccount,
				&employee.ContractType,
				&employee.Location,
				&employee.HireDate,
			); err != nil {
				log.Printf("listEmployees scan failed orgId=%s err=%v", orgID, err)
				writeError(w, http.StatusInternalServerError, "could not load employees")
				return
			}
			employees = append(employees, employee)
		}
		if err := rows.Err(); err != nil {
			log.Printf("listEmployees rows error orgId=%s err=%v", orgID, err)
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
	normalizeEnum := func(value string) string {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return ""
		}
		return strings.ToLower(strings.ReplaceAll(trimmed, " ", "_"))
	}
	req.PayCycle = normalizeEnum(req.PayCycle)
	req.Status = normalizeEnum(req.Status)
	req.ContractType = normalizeEnum(req.ContractType)

	if a.db != nil {
		orgName := ""
		err := a.db.QueryRow(`SELECT name FROM organizations WHERE id = $1`, req.OrgID).Scan(&orgName)
		if err == sql.ErrNoRows {
			writeError(w, http.StatusBadRequest, "organization not found")
			return
		}
		if err != nil {
			log.Printf("createEmployee org lookup failed orgId=%s err=%v", req.OrgID, err)
			writeError(w, http.StatusInternalServerError, "could not save employee")
			return
		}
		prefix := prefixFromName(orgName)

		var lastErr error
		for i := 0; i < 5; i++ {
			seq, err := randomDigits(6)
			if err != nil {
				lastErr = err
				continue
			}
			req.ID = prefix + "-" + seq
			var hireDate sql.NullTime
			if strings.TrimSpace(req.HireDate) != "" {
				if parsed, err := time.Parse("2006-01-02", req.HireDate); err == nil {
					hireDate = sql.NullTime{Time: parsed, Valid: true}
				} else {
					lastErr = err
					log.Printf("createEmployee invalid hire_date orgId=%s value=%s err=%v", req.OrgID, req.HireDate, err)
					break
				}
			}
		if _, err := a.db.Exec(
			`INSERT INTO employees (
         id, org_id, full_name, email, phone, title, position, designation, department, salary, pay_cycle, status,
         tax_id, nssf, nhif, paye, bank_name, bank_account_name, bank_account, contract_type, location, hire_date
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15, $16,
         $17, $18, $19, $20, $21, $22
       )`,
			req.ID,
			req.OrgID,
			req.FullName,
			req.Email,
			req.Phone,
			req.Title,
			req.Position,
			req.Designation,
			req.Department,
			req.Salary,
			req.PayCycle,
			req.Status,
			req.TaxID,
			req.NSSF,
			req.NHIF,
			req.PAYE,
			req.BankName,
			req.BankAccountName,
			req.BankAccount,
			req.ContractType,
			req.Location,
			hireDate,
			); err != nil {
				lastErr = err
				log.Printf("createEmployee insert failed orgId=%s err=%v", req.OrgID, err)
				if strings.Contains(err.Error(), "duplicate key") {
					continue
				}
				break
			}

			writeJSON(w, http.StatusCreated, req)
			return
		}

		if lastErr == sql.ErrNoRows {
			writeError(w, http.StatusBadRequest, "organization not found")
			return
		}
		if lastErr != nil {
			log.Printf("createEmployee failed orgId=%s err=%v", req.OrgID, lastErr)
		}
		if os.Getenv("APP_ENV") == "dev" && lastErr != nil {
			writeError(w, http.StatusInternalServerError, "could not save employee: "+lastErr.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "could not save employee")
		return
	}

	a.mu.Lock()
	prefix := prefixFromName(req.OrgID)
	if name, ok := a.orgNames[req.OrgID]; ok {
		prefix = prefixFromName(name)
	}
	if seq, err := randomDigits(6); err == nil {
		req.ID = prefix + "-" + seq
	} else {
		req.ID = a.nextID("emp")
	}
	a.employees[req.OrgID] = append(a.employees[req.OrgID], req)
	a.mu.Unlock()

	writeJSON(w, http.StatusCreated, req)
}

func (a *App) updateEmployee(w http.ResponseWriter, r *http.Request) {
	var req Employee
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.OrgID = strings.TrimSpace(req.OrgID)
	req.ID = strings.TrimSpace(req.ID)
	if req.OrgID == "" || req.ID == "" {
		writeError(w, http.StatusBadRequest, "orgId and id are required")
		return
	}
	req.PayCycle = normalizeEnum(req.PayCycle)
	req.Status = normalizeEnum(req.Status)
	req.ContractType = normalizeEnum(req.ContractType)

	if a.db != nil {
		var hireDate sql.NullTime
		if strings.TrimSpace(req.HireDate) != "" {
			if parsed, err := time.Parse("2006-01-02", req.HireDate); err == nil {
				hireDate = sql.NullTime{Time: parsed, Valid: true}
			} else {
				log.Printf("updateEmployee invalid hire_date orgId=%s id=%s value=%s err=%v", req.OrgID, req.ID, req.HireDate, err)
				writeError(w, http.StatusBadRequest, "invalid hireDate, expected YYYY-MM-DD")
				return
			}
		}
		res, err := a.db.Exec(
			`UPDATE employees
       SET full_name = $1,
           email = $2,
           phone = $3,
           title = $4,
           position = $5,
           designation = $6,
           department = $7,
           salary = $8,
           pay_cycle = $9,
           status = $10,
           tax_id = $11,
           nssf = $12,
           nhif = $13,
           paye = $14,
           bank_name = $15,
           bank_account_name = $16,
           bank_account = $17,
           contract_type = $18,
           location = $19,
           hire_date = $20
       WHERE id = $21 AND org_id = $22`,
			req.FullName,
			req.Email,
			req.Phone,
			req.Title,
			req.Position,
			req.Designation,
			req.Department,
			req.Salary,
			req.PayCycle,
			req.Status,
			req.TaxID,
			req.NSSF,
			req.NHIF,
			req.PAYE,
			req.BankName,
			req.BankAccountName,
			req.BankAccount,
			req.ContractType,
			req.Location,
			hireDate,
			req.ID,
			req.OrgID,
		)
		if err != nil {
			log.Printf("updateEmployee failed orgId=%s id=%s err=%v", req.OrgID, req.ID, err)
			writeError(w, http.StatusInternalServerError, "could not update employee")
			return
		}
		if rows, _ := res.RowsAffected(); rows == 0 {
			writeError(w, http.StatusNotFound, "employee not found")
			return
		}

		writeJSON(w, http.StatusOK, req)
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	list := a.employees[req.OrgID]
	found := false
	for i := range list {
		if list[i].ID == req.ID {
			list[i] = req
			found = true
			break
		}
	}
	if !found {
		writeError(w, http.StatusNotFound, "employee not found")
		return
	}
	a.employees[req.OrgID] = list
	writeJSON(w, http.StatusOK, req)
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
			log.Printf("deleteEmployee failed orgId=%s id=%s err=%v", orgID, empID, err)
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
