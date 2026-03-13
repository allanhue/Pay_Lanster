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

	a.mu.Lock()
	defer a.mu.Unlock()

	if _, exists := a.approvals[orgID]; !exists {
		a.approvals[orgID] = seedApprovals(orgID)
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
