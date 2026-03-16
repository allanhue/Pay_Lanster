package routes

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type Approval struct {
	ID          string `json:"id"`
	OrgID       string `json:"orgId"`
	Type        string `json:"type"`
	Reference   string `json:"reference"`
	Owner       string `json:"owner"`
	RequestedOn string `json:"requestedOn"`
	Status      string `json:"status"`
}

type approvalStatusRequest struct {
	OrgID  string `json:"orgId"`
	ID     string `json:"id"`
	Status string `json:"status"`
}

func (a *App) approvalsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listApprovals(w, r)
	case http.MethodPost:
		a.updateApprovalStatus(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) listApprovals(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "orgId is required")
		return
	}

	if a.db != nil {
		approvals, err := a.seedApprovalsFromRecords(orgID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load approvals")
			return
		}
		writeJSON(w, http.StatusOK, approvals)
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	if _, exists := a.approvals[orgID]; !exists {
		a.approvals[orgID] = []Approval{}
	}
	writeJSON(w, http.StatusOK, a.approvals[orgID])
}

func (a *App) updateApprovalStatus(w http.ResponseWriter, r *http.Request) {
	var req approvalStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.OrgID = strings.TrimSpace(req.OrgID)
	req.ID = strings.TrimSpace(req.ID)
	req.Status = strings.TrimSpace(req.Status)
	if req.OrgID == "" || req.ID == "" || req.Status == "" {
		writeError(w, http.StatusBadRequest, "orgId, id and status are required")
		return
	}

	if a.db != nil {
		var module string
		var reference string
		var owner string
		var requestedOn string

		err := a.db.QueryRow(
			`UPDATE approvals
       SET status = $1,
           decided_at = NOW()
       WHERE id = $2 AND org_id = $3
       RETURNING module, reference_id, COALESCE(requested_by, ''), TO_CHAR(created_at, 'Mon DD')`,
			req.Status,
			req.ID,
			req.OrgID,
		).Scan(&module, &reference, &owner, &requestedOn)
		if err != nil {
			writeError(w, http.StatusNotFound, "approval not found")
			return
		}

		switch module {
		case "payrun":
			if req.Status == "approved" {
				_, _ = a.db.Exec(`UPDATE payruns SET status = 'approved' WHERE id = $1 AND org_id = $2`, reference, req.OrgID)
			} else if req.Status == "rejected" {
				_, _ = a.db.Exec(`UPDATE payruns SET status = 'draft' WHERE id = $1 AND org_id = $2`, reference, req.OrgID)
			}
		case "payslip":
			_, _ = a.db.Exec(`UPDATE payslips SET approval_status = $1 WHERE id = $2 AND org_id = $3`, req.Status, reference, req.OrgID)
		}

		updated := Approval{
			ID:          req.ID,
			OrgID:       req.OrgID,
			Type:        module,
			Reference:   reference,
			Owner:       owner,
			RequestedOn: requestedOn,
			Status:      req.Status,
		}
		writeJSON(w, http.StatusOK, updated)
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	items := a.approvals[req.OrgID]
	for i := range items {
		if items[i].ID == req.ID {
			items[i].Status = req.Status
			a.approvals[req.OrgID] = items
			writeJSON(w, http.StatusOK, items[i])
			return
		}
	}

	writeError(w, http.StatusNotFound, "approval not found")
}

func seedApprovals(orgID string) []Approval {
	now := time.Now()
	return []Approval{
		{ID: "AP-301", OrgID: orgID, Type: "payrun", Reference: "PR-0426", Owner: "PayrollOps", RequestedOn: now.Add(-3 * time.Hour).Format("Jan 2"), Status: "pending"},
		{ID: "AP-302", OrgID: orgID, Type: "payslip", Reference: "PS-1201", Owner: "Jane Adams", RequestedOn: now.Add(-2 * time.Hour).Format("Jan 2"), Status: "pending"},
		{ID: "AP-303", OrgID: orgID, Type: "benefit", Reference: "Transport uplift", Owner: "HR", RequestedOn: now.Add(-36 * time.Hour).Format("Jan 2"), Status: "approved"},
	}
}

func (a *App) fetchApprovals(orgID string) ([]Approval, error) {
	rows, err := a.db.Query(
		`SELECT id,
       org_id,
       module,
       reference_id,
       COALESCE(requested_by, ''),
       COALESCE(status, 'pending'),
       TO_CHAR(created_at, 'Mon DD')
     FROM approvals
     WHERE org_id = $1
     ORDER BY created_at DESC, id DESC`,
		orgID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	approvals := []Approval{}
	for rows.Next() {
		var row Approval
		if err := rows.Scan(
			&row.ID,
			&row.OrgID,
			&row.Type,
			&row.Reference,
			&row.Owner,
			&row.Status,
			&row.RequestedOn,
		); err != nil {
			return nil, err
		}
		approvals = append(approvals, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return approvals, nil
}

func (a *App) seedApprovalsFromRecords(orgID string) ([]Approval, error) {
	existing, err := a.fetchApprovals(orgID)
	if err != nil {
		return nil, err
	}
	exists := make(map[string]bool, len(existing))
	for _, item := range existing {
		exists[item.Type+"|"+item.Reference] = true
	}

	payrunRows, err := a.db.Query(
		`SELECT id, COALESCE(TO_CHAR(created_at, 'Mon DD'), '')
     FROM payruns
     WHERE org_id = $1 AND COALESCE(status, 'draft') IN ('draft', 'processing')`,
		orgID,
	)
	if err != nil {
		return nil, err
	}
	defer payrunRows.Close()
	for payrunRows.Next() {
		var id string
		var created string
		if err := payrunRows.Scan(&id, &created); err != nil {
			return nil, err
		}
		key := "payrun|" + id
		if exists[key] {
			continue
		}
		_, _ = a.db.Exec(
			`INSERT INTO approvals (id, org_id, module, reference_id, requested_by, status)
       VALUES ($1,$2,'payrun',$3,$4,'pending')`,
			a.nextID("ap"),
			orgID,
			id,
			"Payroll",
		)
		exists[key] = true
		_ = created
	}
	if err := payrunRows.Err(); err != nil {
		return nil, err
	}

	payslipRows, err := a.db.Query(
		`SELECT id, COALESCE(employee_name, '') FROM payslips WHERE org_id = $1 AND COALESCE(approval_status, 'pending') = 'pending'`,
		orgID,
	)
	if err != nil {
		return nil, err
	}
	defer payslipRows.Close()
	for payslipRows.Next() {
		var id string
		var owner string
		if err := payslipRows.Scan(&id, &owner); err != nil {
			return nil, err
		}
		key := "payslip|" + id
		if exists[key] {
			continue
		}
		_, _ = a.db.Exec(
			`INSERT INTO approvals (id, org_id, module, reference_id, requested_by, status)
       VALUES ($1,$2,'payslip',$3,$4,'pending')`,
			a.nextID("ap"),
			orgID,
			id,
			owner,
		)
		exists[key] = true
	}
	if err := payslipRows.Err(); err != nil {
		return nil, err
	}

	return a.fetchApprovals(orgID)
}
