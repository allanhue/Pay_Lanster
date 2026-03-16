package routes

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type Benefit struct {
	ID            string  `json:"id"`
	OrgID         string  `json:"orgId"`
	Name          string  `json:"name"`
	Amount        float64 `json:"amount"`
	Frequency     string  `json:"frequency"`
	Taxable       bool    `json:"taxable"`
	Status        string  `json:"status"`
	EffectiveDate string  `json:"effectiveDate"`
}

func (a *App) benefitsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listBenefits(w, r)
	case http.MethodPost:
		a.createBenefit(w, r)
	case http.MethodDelete:
		a.deleteBenefit(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) listBenefits(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "orgId is required")
		return
	}

	if a.db != nil {
		rows, err := a.db.Query(
			`SELECT id,
         org_id,
         name,
         COALESCE(amount, 0),
         COALESCE(frequency, ''),
         COALESCE(taxable, false),
         COALESCE(status, 'active'),
         COALESCE(TO_CHAR(effective_date, 'YYYY-MM-DD'), '')
       FROM benefits
       WHERE org_id = $1
       ORDER BY created_at DESC, id DESC`,
			orgID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load benefits")
			return
		}
		defer rows.Close()

		benefits := []Benefit{}
		for rows.Next() {
			var row Benefit
			if err := rows.Scan(
				&row.ID,
				&row.OrgID,
				&row.Name,
				&row.Amount,
				&row.Frequency,
				&row.Taxable,
				&row.Status,
				&row.EffectiveDate,
			); err != nil {
				writeError(w, http.StatusInternalServerError, "could not load benefits")
				return
			}
			benefits = append(benefits, row)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "could not load benefits")
			return
		}
		writeJSON(w, http.StatusOK, benefits)
		return
	}

	a.mu.RLock()
	list := append([]Benefit(nil), a.benefits[orgID]...)
	a.mu.RUnlock()
	writeJSON(w, http.StatusOK, list)
}

func (a *App) createBenefit(w http.ResponseWriter, r *http.Request) {
	var req Benefit
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.OrgID = strings.TrimSpace(req.OrgID)
	req.Name = strings.TrimSpace(req.Name)
	req.EffectiveDate = strings.TrimSpace(req.EffectiveDate)
	if req.OrgID == "" || req.Name == "" {
		writeError(w, http.StatusBadRequest, "orgId and name are required")
		return
	}
	if req.Frequency == "" {
		req.Frequency = "Monthly"
	}
	if req.Status == "" {
		req.Status = "active"
	}

	if a.db != nil {
		req.ID = a.nextID("bf")
		var effectiveDate sql.NullTime
		if req.EffectiveDate != "" {
			if parsed, err := time.Parse("2006-01-02", req.EffectiveDate); err == nil {
				effectiveDate = sql.NullTime{Time: parsed, Valid: true}
			}
		}

		if _, err := a.db.Exec(
			`INSERT INTO benefits (
         id, org_id, name, amount, frequency, taxable, status, effective_date
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			req.ID,
			req.OrgID,
			req.Name,
			req.Amount,
			req.Frequency,
			req.Taxable,
			req.Status,
			effectiveDate,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "could not save benefit")
			return
		}

		writeJSON(w, http.StatusCreated, req)
		return
	}

	a.mu.Lock()
	req.ID = a.nextID("bf")
	a.benefits[req.OrgID] = append([]Benefit{req}, a.benefits[req.OrgID]...)
	a.mu.Unlock()
	writeJSON(w, http.StatusCreated, req)
}

func (a *App) deleteBenefit(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	benefitID := strings.TrimSpace(r.URL.Query().Get("id"))
	if orgID == "" || benefitID == "" {
		writeError(w, http.StatusBadRequest, "orgId and id are required")
		return
	}

	if a.db != nil {
		res, err := a.db.Exec(`DELETE FROM benefits WHERE id = $1 AND org_id = $2`, benefitID, orgID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not delete benefit")
			return
		}
		if rows, _ := res.RowsAffected(); rows == 0 {
			writeError(w, http.StatusNotFound, "benefit not found")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	list := a.benefits[orgID]
	next := list[:0]
	found := false
	for _, benefit := range list {
		if benefit.ID == benefitID {
			found = true
			continue
		}
		next = append(next, benefit)
	}
	a.benefits[orgID] = next
	if !found {
		writeError(w, http.StatusNotFound, "benefit not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}
