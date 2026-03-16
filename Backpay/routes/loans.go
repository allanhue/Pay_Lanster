package routes

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type Loan struct {
	ID          string  `json:"id"`
	OrgID       string  `json:"orgId"`
	Employee    string  `json:"employee"`
	Amount      float64 `json:"amount"`
	Outstanding float64 `json:"outstanding"`
	NextPayment string  `json:"nextPayment"`
	Status      string  `json:"status"`
	Purpose     string  `json:"purpose,omitempty"`
	Tenure      int     `json:"tenure,omitempty"`
	Rate        float64 `json:"rate,omitempty"`
}

func (a *App) loansHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listLoans(w, r)
	case http.MethodPost:
		a.createLoan(w, r)
	case http.MethodPut:
		a.updateLoan(w, r)
	case http.MethodDelete:
		a.deleteLoan(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) listLoans(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "orgId is required")
		return
	}

	if a.db != nil {
		rows, err := a.db.Query(
			`SELECT id,
         org_id,
         employee,
         amount,
         outstanding,
         COALESCE(TO_CHAR(next_payment, 'YYYY-MM-DD'), ''),
         COALESCE(status, 'open'),
         COALESCE(purpose, ''),
         COALESCE(tenure, 0),
         COALESCE(rate, 0)
       FROM loans
       WHERE org_id = $1
       ORDER BY created_at DESC, id DESC`,
			orgID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load loans")
			return
		}
		defer rows.Close()

		loans := []Loan{}
		for rows.Next() {
			var row Loan
			if err := rows.Scan(
				&row.ID,
				&row.OrgID,
				&row.Employee,
				&row.Amount,
				&row.Outstanding,
				&row.NextPayment,
				&row.Status,
				&row.Purpose,
				&row.Tenure,
				&row.Rate,
			); err != nil {
				writeError(w, http.StatusInternalServerError, "could not load loans")
				return
			}
			loans = append(loans, row)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "could not load loans")
			return
		}
		writeJSON(w, http.StatusOK, loans)
		return
	}

	a.mu.RLock()
	list := append([]Loan(nil), a.loans[orgID]...)
	a.mu.RUnlock()
	writeJSON(w, http.StatusOK, list)
}

func (a *App) createLoan(w http.ResponseWriter, r *http.Request) {
	var req Loan
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.OrgID = strings.TrimSpace(req.OrgID)
	req.Employee = strings.TrimSpace(req.Employee)
	req.NextPayment = strings.TrimSpace(req.NextPayment)
	if req.OrgID == "" || req.Employee == "" || req.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "orgId, employee, and amount are required")
		return
	}
	if req.Outstanding <= 0 {
		req.Outstanding = req.Amount
	}
	if req.Status == "" {
		req.Status = "open"
	}

	if a.db != nil {
		req.ID = a.nextID("ln")
		var nextPayment sql.NullTime
		if req.NextPayment != "" {
			if parsed, err := time.Parse("2006-01-02", req.NextPayment); err == nil {
				nextPayment = sql.NullTime{Time: parsed, Valid: true}
			}
		}

		if _, err := a.db.Exec(
			`INSERT INTO loans (
         id, org_id, employee, amount, outstanding, next_payment, status, purpose, tenure, rate
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			req.ID,
			req.OrgID,
			req.Employee,
			req.Amount,
			req.Outstanding,
			nextPayment,
			req.Status,
			req.Purpose,
			sql.NullInt32{Int32: int32(req.Tenure), Valid: req.Tenure > 0},
			sql.NullFloat64{Float64: req.Rate, Valid: req.Rate > 0},
		); err != nil {
			writeError(w, http.StatusInternalServerError, "could not save loan")
			return
		}

		writeJSON(w, http.StatusCreated, req)
		return
	}

	a.mu.Lock()
	req.ID = a.nextID("ln")
	a.loans[req.OrgID] = append([]Loan{req}, a.loans[req.OrgID]...)
	a.mu.Unlock()
	writeJSON(w, http.StatusCreated, req)
}

func (a *App) updateLoan(w http.ResponseWriter, r *http.Request) {
	var req Loan
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

	if a.db != nil {
		var nextPayment sql.NullTime
		if strings.TrimSpace(req.NextPayment) != "" {
			if parsed, err := time.Parse("2006-01-02", req.NextPayment); err == nil {
				nextPayment = sql.NullTime{Time: parsed, Valid: true}
			}
		}

		res, err := a.db.Exec(
			`UPDATE loans
       SET employee = $1,
           amount = $2,
           outstanding = $3,
           next_payment = $4,
           status = $5,
           purpose = $6,
           tenure = $7,
           rate = $8
       WHERE id = $9 AND org_id = $10`,
			req.Employee,
			req.Amount,
			req.Outstanding,
			nextPayment,
			req.Status,
			req.Purpose,
			sql.NullInt32{Int32: int32(req.Tenure), Valid: req.Tenure > 0},
			sql.NullFloat64{Float64: req.Rate, Valid: req.Rate > 0},
			req.ID,
			req.OrgID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not update loan")
			return
		}
		if rows, _ := res.RowsAffected(); rows == 0 {
			writeError(w, http.StatusNotFound, "loan not found")
			return
		}
		writeJSON(w, http.StatusOK, req)
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	list := a.loans[req.OrgID]
	found := false
	for i := range list {
		if list[i].ID == req.ID {
			list[i] = req
			found = true
			break
		}
	}
	if !found {
		writeError(w, http.StatusNotFound, "loan not found")
		return
	}
	a.loans[req.OrgID] = list
	writeJSON(w, http.StatusOK, req)
}

func (a *App) deleteLoan(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	loanID := strings.TrimSpace(r.URL.Query().Get("id"))
	if orgID == "" || loanID == "" {
		writeError(w, http.StatusBadRequest, "orgId and id are required")
		return
	}

	if a.db != nil {
		res, err := a.db.Exec(`DELETE FROM loans WHERE id = $1 AND org_id = $2`, loanID, orgID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not delete loan")
			return
		}
		if rows, _ := res.RowsAffected(); rows == 0 {
			writeError(w, http.StatusNotFound, "loan not found")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	list := a.loans[orgID]
	next := list[:0]
	found := false
	for _, loan := range list {
		if loan.ID == loanID {
			found = true
			continue
		}
		next = append(next, loan)
	}
	a.loans[orgID] = next
	if !found {
		writeError(w, http.StatusNotFound, "loan not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}
