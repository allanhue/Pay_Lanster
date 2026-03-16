package routes

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
)

type Payslip struct {
	ID        string  `json:"id"`
	OrgID     string  `json:"orgId"`
	Employee  string  `json:"employee"`
	Email     string  `json:"email"`
	Period    string  `json:"period"`
	Gross     float64 `json:"gross"`
	Deductions float64 `json:"deductions"`
	Net       float64 `json:"net"`
	Approval  string  `json:"approval"`
	CreatedAt string  `json:"createdAt,omitempty"`
}

func (a *App) payslipsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listPayslips(w, r)
	case http.MethodPost:
		a.createPayslip(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) listPayslips(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "orgId is required")
		return
	}

	if a.db != nil {
		rows, err := a.db.Query(
			`SELECT id,
         org_id,
         employee_name,
         COALESCE(employee_email, ''),
         period,
         gross_pay,
         deductions,
         net_pay,
         COALESCE(approval_status, 'pending'),
         TO_CHAR(created_at, 'YYYY-MM-DD')
       FROM payslips
       WHERE org_id = $1
       ORDER BY created_at DESC, id DESC`,
			orgID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load payslips")
			return
		}
		defer rows.Close()

		payslips := []Payslip{}
		for rows.Next() {
			var row Payslip
			if err := rows.Scan(
				&row.ID,
				&row.OrgID,
				&row.Employee,
				&row.Email,
				&row.Period,
				&row.Gross,
				&row.Deductions,
				&row.Net,
				&row.Approval,
				&row.CreatedAt,
			); err != nil {
				writeError(w, http.StatusInternalServerError, "could not load payslips")
				return
			}
			payslips = append(payslips, row)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "could not load payslips")
			return
		}
		writeJSON(w, http.StatusOK, payslips)
		return
	}

	a.mu.RLock()
	list := append([]Payslip(nil), a.payslips[orgID]...)
	a.mu.RUnlock()
	writeJSON(w, http.StatusOK, list)
}

func (a *App) createPayslip(w http.ResponseWriter, r *http.Request) {
	var req Payslip
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.OrgID = strings.TrimSpace(req.OrgID)
	req.Employee = strings.TrimSpace(req.Employee)
	req.Email = strings.TrimSpace(req.Email)
	req.Period = strings.TrimSpace(req.Period)
	if req.OrgID == "" || req.Employee == "" || req.Period == "" {
		writeError(w, http.StatusBadRequest, "orgId, employee, and period are required")
		return
	}
	if req.Approval == "" {
		req.Approval = "pending"
	}

	if a.db != nil {
		req.ID = a.nextID("ps")
		if _, err := a.db.Exec(
			`INSERT INTO payslips (
         id, org_id, employee_name, employee_email, period, gross_pay, deductions, net_pay, approval_status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			req.ID,
			req.OrgID,
			req.Employee,
			sql.NullString{String: req.Email, Valid: req.Email != ""},
			req.Period,
			req.Gross,
			req.Deductions,
			req.Net,
			req.Approval,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "could not save payslip")
			return
		}

		_, _ = a.db.Exec(
			`INSERT INTO approvals (id, org_id, module, reference_id, requested_by, status)
       VALUES ($1,$2,'payslip',$3,$4,'pending') ON CONFLICT DO NOTHING`,
			a.nextID("ap"),
			req.OrgID,
			req.ID,
			req.Employee,
		)

		writeJSON(w, http.StatusCreated, req)
		return
	}

	a.mu.Lock()
	req.ID = a.nextID("ps")
	a.payslips[req.OrgID] = append([]Payslip{req}, a.payslips[req.OrgID]...)
	a.mu.Unlock()
	writeJSON(w, http.StatusCreated, req)
}
