package routes

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"
)

type Payrun struct {
	ID         string  `json:"id"`
	OrgID      string  `json:"orgId"`
	Period     string  `json:"period"`
	Payday     string  `json:"payday"`
	NetPayroll float64 `json:"netPayroll"`
	GrossPay   float64 `json:"grossPay"`
	Deductions float64 `json:"deductions"`
	Employees  int     `json:"employees"`
	Status     string  `json:"status"`
	CreatedAt  string  `json:"createdAt,omitempty"`
}

func (a *App) payrunsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listPayruns(w, r)
	case http.MethodPost:
		a.createPayrun(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) listPayruns(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "orgId is required")
		return
	}

	if a.db != nil {
		rows, err := a.db.Query(
			`SELECT id,
         org_id,
         COALESCE(period, ''),
         COALESCE(TO_CHAR(payday, 'YYYY-MM-DD'), ''),
         COALESCE(net_payroll, 0),
         COALESCE(gross_pay, 0),
         COALESCE(deductions, 0),
         COALESCE(employees, 0),
         COALESCE(status, 'draft'),
         TO_CHAR(created_at, 'YYYY-MM-DD')
       FROM payruns
       WHERE org_id = $1
       ORDER BY created_at DESC, id DESC`,
			orgID,
		)
		if err != nil {
			log.Printf("listPayruns query failed orgId=%s err=%v", orgID, err)
			writeError(w, http.StatusInternalServerError, "could not load payruns")
			return
		}
		defer rows.Close()

		payruns := []Payrun{}
		for rows.Next() {
			var row Payrun
			if err := rows.Scan(
				&row.ID,
				&row.OrgID,
				&row.Period,
				&row.Payday,
				&row.NetPayroll,
				&row.GrossPay,
				&row.Deductions,
				&row.Employees,
				&row.Status,
				&row.CreatedAt,
			); err != nil {
				log.Printf("listPayruns scan failed orgId=%s err=%v", orgID, err)
				writeError(w, http.StatusInternalServerError, "could not load payruns")
				return
			}
			payruns = append(payruns, row)
		}
		if err := rows.Err(); err != nil {
			log.Printf("listPayruns rows error orgId=%s err=%v", orgID, err)
			writeError(w, http.StatusInternalServerError, "could not load payruns")
			return
		}

		writeJSON(w, http.StatusOK, payruns)
		return
	}

	a.mu.RLock()
	list := append([]Payrun(nil), a.payruns[orgID]...)
	a.mu.RUnlock()
	writeJSON(w, http.StatusOK, list)
}

func (a *App) createPayrun(w http.ResponseWriter, r *http.Request) {
	var req Payrun
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.OrgID = strings.TrimSpace(req.OrgID)
	req.Period = strings.TrimSpace(req.Period)
	req.Payday = strings.TrimSpace(req.Payday)
	if req.OrgID == "" || req.Period == "" {
		writeError(w, http.StatusBadRequest, "orgId and period are required")
		return
	}
	if req.Status == "" {
		req.Status = "draft"
	}

	if a.db != nil {
		req.ID = a.nextID("pr")
		var payday sql.NullTime
		if req.Payday != "" {
			if parsed, err := time.Parse("2006-01-02", req.Payday); err == nil {
				payday = sql.NullTime{Time: parsed, Valid: true}
			}
		}

		if _, err := a.db.Exec(
			`INSERT INTO payruns (
         id, org_id, period, payday, net_payroll, gross_pay, deductions, employees, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			req.ID,
			req.OrgID,
			req.Period,
			payday,
			req.NetPayroll,
			req.GrossPay,
			req.Deductions,
			req.Employees,
			req.Status,
		); err != nil {
			log.Printf("createPayrun insert failed orgId=%s err=%v", req.OrgID, err)
			writeError(w, http.StatusInternalServerError, "could not save payrun")
			return
		}

		_, _ = a.db.Exec(
			`INSERT INTO approvals (id, org_id, module, reference_id, requested_by, status)
       VALUES ($1,$2,'payrun',$3,$4,'pending') ON CONFLICT DO NOTHING`,
			a.nextID("ap"),
			req.OrgID,
			req.ID,
			"Payroll",
		)

		_ = a.generatePayslipsForPayrun(req)
		writeJSON(w, http.StatusCreated, req)
		return
	}

	a.mu.Lock()
	req.ID = a.nextID("pr")
	a.payruns[req.OrgID] = append([]Payrun{req}, a.payruns[req.OrgID]...)
	a.mu.Unlock()
	_ = a.generatePayslipsForPayrun(req)
	writeJSON(w, http.StatusCreated, req)
}

func (a *App) generatePayslipsForPayrun(payrun Payrun) error {
	orgID := strings.TrimSpace(payrun.OrgID)
	if orgID == "" || strings.TrimSpace(payrun.Period) == "" {
		return nil
	}

	if a.db != nil {
		rows, err := a.db.Query(
			`SELECT full_name,
         COALESCE(email, ''),
         salary,
         COALESCE(pay_cycle, 'monthly'),
         COALESCE(status, 'active')
       FROM employees
       WHERE org_id = $1`,
			orgID,
		)
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var name, email, payCycle, status string
			var salary float64
			if err := rows.Scan(&name, &email, &salary, &payCycle, &status); err != nil {
				return err
			}
			if strings.TrimSpace(name) == "" {
				continue
			}
			if status != "" && status != "active" {
				continue
			}
			var gross float64
			if strings.ToLower(payCycle) == "biweekly" {
				gross = salary / 26
			} else {
				gross = salary / 12
			}
			deductions := gross * 0.18
			net := gross - deductions

			var exists string
			err := a.db.QueryRow(
				`SELECT id FROM payslips WHERE org_id = $1 AND employee_name = $2 AND period = $3 LIMIT 1`,
				orgID,
				name,
				payrun.Period,
			).Scan(&exists)
			if err == nil && exists != "" {
				continue
			}

			payslipID := a.nextID("ps")
			_, _ = a.db.Exec(
				`INSERT INTO payslips (
         id, org_id, employee_name, employee_email, period, gross_pay, deductions, net_pay, approval_status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
				payslipID,
				orgID,
				name,
				sql.NullString{String: email, Valid: email != ""},
				payrun.Period,
				gross,
				deductions,
				net,
				"approved",
			)
		}
		return rows.Err()
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	employees := a.employees[orgID]
	if len(employees) == 0 {
		return nil
	}
	existing := a.payslips[orgID]
	for _, emp := range employees {
		if emp.FullName == "" {
			continue
		}
		if emp.Status != "" && emp.Status != "active" {
			continue
		}
		duplicate := false
		for _, slip := range existing {
			if slip.Employee == emp.FullName && slip.Period == payrun.Period {
				duplicate = true
				break
			}
		}
		if duplicate {
			continue
		}
		gross := emp.Salary / 12
		if strings.ToLower(emp.PayCycle) == "biweekly" {
			gross = emp.Salary / 26
		}
		deductions := gross * 0.18
		net := gross - deductions
		payslip := Payslip{
			ID:        a.nextID("ps"),
			OrgID:     orgID,
			Employee:  emp.FullName,
			Email:     emp.Email,
			Period:    payrun.Period,
			Gross:     gross,
			Deductions: deductions,
			Net:       net,
			Approval:  "approved",
		}
		existing = append([]Payslip{payslip}, existing...)
	}
	a.payslips[orgID] = existing
	return nil
}
