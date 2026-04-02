package routes

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type LeaveType struct {
	ID          string `json:"id"`
	OrgID       string `json:"orgId"`
	Code        string `json:"code"`
	Label       string `json:"label"`
	DefaultDays int    `json:"defaultDays"`
	RequiresDoc bool   `json:"requiresDoc"`
	Color       string `json:"color"`
	AccentColor string `json:"accentColor"`
	Status      string `json:"status"`
}

type LeaveRequest struct {
	ID           string `json:"id"`
	OrgID        string `json:"orgId"`
	EmployeeID   string `json:"employeeId"`
	EmployeeName string `json:"employeeName"`
	Department   string `json:"department"`
	TypeCode     string `json:"typeCode"`
	TypeLabel    string `json:"typeLabel"`
	StartDate    string `json:"startDate"`
	EndDate      string `json:"endDate"`
	Days         int    `json:"days"`
	Reason       string `json:"reason"`
	Status       string `json:"status"`
	AppliedOn    string `json:"appliedOn"`
	ReviewedBy   string `json:"reviewedBy,omitempty"`
	ReviewedOn   string `json:"reviewedOn,omitempty"`
	ReviewNote   string `json:"reviewNote,omitempty"`
}

func normalizeCode(input string) string {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return ""
	}
	trimmed = strings.ToLower(trimmed)
	trimmed = strings.ReplaceAll(trimmed, " ", "_")
	return trimmed
}

func (a *App) leaveTypesHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listLeaveTypes(w, r)
	case http.MethodPost:
		a.createLeaveType(w, r)
	case http.MethodPut:
		a.updateLeaveType(w, r)
	case http.MethodDelete:
		a.deleteLeaveType(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) leaveRequestsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listLeaveRequests(w, r)
	case http.MethodPost:
		a.createLeaveRequest(w, r)
	case http.MethodPut:
		a.updateLeaveRequest(w, r)
	case http.MethodDelete:
		a.deleteLeaveRequest(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) listLeaveTypes(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "orgId is required")
		return
	}

	if a.db != nil {
		rows, err := a.db.Query(
			`SELECT id, org_id, code, label, COALESCE(default_days, 0), COALESCE(requires_doc, false), COALESCE(color, ''), COALESCE(accent_color, ''), COALESCE(status, 'active')
             FROM leave_types
             WHERE org_id = $1
             ORDER BY created_at DESC, id DESC`,
			orgID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load leave types")
			return
		}
		defer rows.Close()

		list := []LeaveType{}
		for rows.Next() {
			var row LeaveType
			if err := rows.Scan(
				&row.ID,
				&row.OrgID,
				&row.Code,
				&row.Label,
				&row.DefaultDays,
				&row.RequiresDoc,
				&row.Color,
				&row.AccentColor,
				&row.Status,
			); err != nil {
				writeError(w, http.StatusInternalServerError, "could not load leave types")
				return
			}
			list = append(list, row)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "could not load leave types")
			return
		}

		writeJSON(w, http.StatusOK, list)
		return
	}

	a.mu.RLock()
	list := append([]LeaveType(nil), a.leaveTypes[orgID]...)
	a.mu.RUnlock()
	writeJSON(w, http.StatusOK, list)
}

func (a *App) createLeaveType(w http.ResponseWriter, r *http.Request) {
	var req LeaveType
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.OrgID = strings.TrimSpace(req.OrgID)
	req.Code = normalizeCode(req.Code)
	req.Label = strings.TrimSpace(req.Label)
	if req.OrgID == "" || req.Code == "" || req.Label == "" {
		writeError(w, http.StatusBadRequest, "orgId, code, and label are required")
		return
	}
	if req.Status == "" {
		req.Status = "active"
	}
	if req.Color == "" {
		req.Color = "var(--accent-subtle)"
	}
	if req.AccentColor == "" {
		req.AccentColor = "var(--accent)"
	}

	if a.db != nil {
		req.ID = a.nextID("lt")
		if _, err := a.db.Exec(
			`INSERT INTO leave_types (id, org_id, code, label, default_days, requires_doc, color, accent_color, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			req.ID,
			req.OrgID,
			req.Code,
			req.Label,
			req.DefaultDays,
			req.RequiresDoc,
			req.Color,
			req.AccentColor,
			req.Status,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "could not save leave type")
			return
		}
		writeJSON(w, http.StatusCreated, req)
		return
	}

	a.mu.Lock()
	req.ID = a.nextID("lt")
	a.leaveTypes[req.OrgID] = append([]LeaveType{req}, a.leaveTypes[req.OrgID]...)
	a.mu.Unlock()
	writeJSON(w, http.StatusCreated, req)
}

func (a *App) updateLeaveType(w http.ResponseWriter, r *http.Request) {
	var req LeaveType
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.OrgID = strings.TrimSpace(req.OrgID)
	req.ID = strings.TrimSpace(req.ID)
	req.Code = normalizeCode(req.Code)
	req.Label = strings.TrimSpace(req.Label)
	if req.OrgID == "" || req.ID == "" || req.Code == "" || req.Label == "" {
		writeError(w, http.StatusBadRequest, "orgId, id, code, and label are required")
		return
	}
	if req.Status == "" {
		req.Status = "active"
	}

	if a.db != nil {
		res, err := a.db.Exec(
			`UPDATE leave_types
             SET code = $1,
                 label = $2,
                 default_days = $3,
                 requires_doc = $4,
                 color = $5,
                 accent_color = $6,
                 status = $7
             WHERE id = $8 AND org_id = $9`,
			req.Code,
			req.Label,
			req.DefaultDays,
			req.RequiresDoc,
			req.Color,
			req.AccentColor,
			req.Status,
			req.ID,
			req.OrgID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not update leave type")
			return
		}
		if rows, _ := res.RowsAffected(); rows == 0 {
			writeError(w, http.StatusNotFound, "leave type not found")
			return
		}
		writeJSON(w, http.StatusOK, req)
		return
	}

	a.mu.Lock()
	list := a.leaveTypes[req.OrgID]
	found := false
	for i := range list {
		if list[i].ID == req.ID {
			list[i] = req
			found = true
			break
		}
	}
	if !found {
		a.mu.Unlock()
		writeError(w, http.StatusNotFound, "leave type not found")
		return
	}
	a.leaveTypes[req.OrgID] = list
	a.mu.Unlock()
	writeJSON(w, http.StatusOK, req)
}

func (a *App) deleteLeaveType(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	typeID := strings.TrimSpace(r.URL.Query().Get("id"))
	if orgID == "" || typeID == "" {
		writeError(w, http.StatusBadRequest, "orgId and id are required")
		return
	}

	if a.db != nil {
		res, err := a.db.Exec(`DELETE FROM leave_types WHERE id = $1 AND org_id = $2`, typeID, orgID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not delete leave type")
			return
		}
		if rows, _ := res.RowsAffected(); rows == 0 {
			writeError(w, http.StatusNotFound, "leave type not found")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
		return
	}

	a.mu.Lock()
	list := a.leaveTypes[orgID]
	next := list[:0]
	found := false
	for _, t := range list {
		if t.ID == typeID {
			found = true
			continue
		}
		next = append(next, t)
	}
	a.leaveTypes[orgID] = next
	a.mu.Unlock()
	if !found {
		writeError(w, http.StatusNotFound, "leave type not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

func (a *App) listLeaveRequests(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "orgId is required")
		return
	}

	if a.db != nil {
		rows, err := a.db.Query(
			`SELECT id, org_id, employee_id, employee_name, department, type_code, type_label,
                    COALESCE(TO_CHAR(start_date, 'YYYY-MM-DD'), ''), COALESCE(TO_CHAR(end_date, 'YYYY-MM-DD'), ''),
                    COALESCE(days, 0), COALESCE(reason, ''), COALESCE(status, 'pending'),
                    COALESCE(TO_CHAR(applied_on, 'YYYY-MM-DD'), ''), COALESCE(reviewed_by, ''),
                    COALESCE(TO_CHAR(reviewed_on, 'YYYY-MM-DD'), ''), COALESCE(review_note, '')
             FROM leave_requests
             WHERE org_id = $1
             ORDER BY created_at DESC, id DESC`,
			orgID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load leave requests")
			return
		}
		defer rows.Close()

		list := []LeaveRequest{}
		for rows.Next() {
			var row LeaveRequest
			if err := rows.Scan(
				&row.ID,
				&row.OrgID,
				&row.EmployeeID,
				&row.EmployeeName,
				&row.Department,
				&row.TypeCode,
				&row.TypeLabel,
				&row.StartDate,
				&row.EndDate,
				&row.Days,
				&row.Reason,
				&row.Status,
				&row.AppliedOn,
				&row.ReviewedBy,
				&row.ReviewedOn,
				&row.ReviewNote,
			); err != nil {
				writeError(w, http.StatusInternalServerError, "could not load leave requests")
				return
			}
			list = append(list, row)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "could not load leave requests")
			return
		}
		writeJSON(w, http.StatusOK, list)
		return
	}

	a.mu.RLock()
	list := append([]LeaveRequest(nil), a.leaveRequests[orgID]...)
	a.mu.RUnlock()
	writeJSON(w, http.StatusOK, list)
}

func (a *App) createLeaveRequest(w http.ResponseWriter, r *http.Request) {
	var req LeaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.OrgID = strings.TrimSpace(req.OrgID)
	req.EmployeeID = strings.TrimSpace(req.EmployeeID)
	req.EmployeeName = strings.TrimSpace(req.EmployeeName)
	req.Department = strings.TrimSpace(req.Department)
	req.TypeCode = normalizeCode(req.TypeCode)
	req.TypeLabel = strings.TrimSpace(req.TypeLabel)
	req.Reason = strings.TrimSpace(req.Reason)
	req.Status = strings.TrimSpace(req.Status)
	if req.OrgID == "" || req.EmployeeID == "" || req.EmployeeName == "" || req.TypeCode == "" || req.TypeLabel == "" || req.StartDate == "" || req.EndDate == "" || req.Days <= 0 {
		writeError(w, http.StatusBadRequest, "missing required leave request fields")
		return
	}
	if req.Status == "" {
		req.Status = "pending"
	}
	if req.AppliedOn == "" {
		req.AppliedOn = time.Now().Format("2006-01-02")
	}

	if a.db != nil {
		req.ID = a.nextID("lr")
		startDate, err := time.Parse("2006-01-02", req.StartDate)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid startDate, expected YYYY-MM-DD")
			return
		}
		endDate, err := time.Parse("2006-01-02", req.EndDate)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid endDate, expected YYYY-MM-DD")
			return
		}
		appliedOn, err := time.Parse("2006-01-02", req.AppliedOn)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid appliedOn, expected YYYY-MM-DD")
			return
		}

		var reviewedOn sql.NullTime
		if strings.TrimSpace(req.ReviewedOn) != "" {
			if parsed, err := time.Parse("2006-01-02", req.ReviewedOn); err == nil {
				reviewedOn = sql.NullTime{Time: parsed, Valid: true}
			}
		}

		if _, err := a.db.Exec(
			`INSERT INTO leave_requests (
                id, org_id, employee_id, employee_name, department, type_code, type_label,
                start_date, end_date, days, reason, status, applied_on, reviewed_by, reviewed_on, review_note
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
			req.ID,
			req.OrgID,
			req.EmployeeID,
			req.EmployeeName,
			req.Department,
			req.TypeCode,
			req.TypeLabel,
			startDate,
			endDate,
			req.Days,
			req.Reason,
			req.Status,
			appliedOn,
			req.ReviewedBy,
			reviewedOn,
			req.ReviewNote,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "could not save leave request")
			return
		}

		writeJSON(w, http.StatusCreated, req)
		return
	}

	a.mu.Lock()
	req.ID = a.nextID("lr")
	a.leaveRequests[req.OrgID] = append([]LeaveRequest{req}, a.leaveRequests[req.OrgID]...)
	a.mu.Unlock()
	writeJSON(w, http.StatusCreated, req)
}

func (a *App) updateLeaveRequest(w http.ResponseWriter, r *http.Request) {
	var req LeaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.OrgID = strings.TrimSpace(req.OrgID)
	req.ID = strings.TrimSpace(req.ID)
	req.EmployeeID = strings.TrimSpace(req.EmployeeID)
	req.EmployeeName = strings.TrimSpace(req.EmployeeName)
	req.Department = strings.TrimSpace(req.Department)
	req.TypeCode = normalizeCode(req.TypeCode)
	req.TypeLabel = strings.TrimSpace(req.TypeLabel)
	req.Reason = strings.TrimSpace(req.Reason)
	if req.OrgID == "" || req.ID == "" || req.EmployeeID == "" || req.EmployeeName == "" || req.TypeCode == "" || req.TypeLabel == "" || req.StartDate == "" || req.EndDate == "" || req.Days <= 0 {
		writeError(w, http.StatusBadRequest, "missing required leave request fields")
		return
	}
	if req.Status == "" {
		req.Status = "pending"
	}

	if a.db != nil {
		startDate, err := time.Parse("2006-01-02", req.StartDate)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid startDate, expected YYYY-MM-DD")
			return
		}
		endDate, err := time.Parse("2006-01-02", req.EndDate)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid endDate, expected YYYY-MM-DD")
			return
		}
		appliedOn, err := time.Parse("2006-01-02", req.AppliedOn)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid appliedOn, expected YYYY-MM-DD")
			return
		}

		var reviewedOn sql.NullTime
		if strings.TrimSpace(req.ReviewedOn) != "" {
			if parsed, err := time.Parse("2006-01-02", req.ReviewedOn); err == nil {
				reviewedOn = sql.NullTime{Time: parsed, Valid: true}
			}
		}

		res, err := a.db.Exec(
			`UPDATE leave_requests
             SET employee_id = $1,
                 employee_name = $2,
                 department = $3,
                 type_code = $4,
                 type_label = $5,
                 start_date = $6,
                 end_date = $7,
                 days = $8,
                 reason = $9,
                 status = $10,
                 applied_on = $11,
                 reviewed_by = $12,
                 reviewed_on = $13,
                 review_note = $14
             WHERE id = $15 AND org_id = $16`,
			req.EmployeeID,
			req.EmployeeName,
			req.Department,
			req.TypeCode,
			req.TypeLabel,
			startDate,
			endDate,
			req.Days,
			req.Reason,
			req.Status,
			appliedOn,
			req.ReviewedBy,
			reviewedOn,
			req.ReviewNote,
			req.ID,
			req.OrgID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not update leave request")
			return
		}
		if rows, _ := res.RowsAffected(); rows == 0 {
			writeError(w, http.StatusNotFound, "leave request not found")
			return
		}

		writeJSON(w, http.StatusOK, req)
		return
	}

	a.mu.Lock()
	list := a.leaveRequests[req.OrgID]
	found := false
	for i := range list {
		if list[i].ID == req.ID {
			list[i] = req
			found = true
			break
		}
	}
	if !found {
		a.mu.Unlock()
		writeError(w, http.StatusNotFound, "leave request not found")
		return
	}
	a.leaveRequests[req.OrgID] = list
	a.mu.Unlock()
	writeJSON(w, http.StatusOK, req)
}

func (a *App) deleteLeaveRequest(w http.ResponseWriter, r *http.Request) {
	orgID := strings.TrimSpace(r.URL.Query().Get("orgId"))
	reqID := strings.TrimSpace(r.URL.Query().Get("id"))
	if orgID == "" || reqID == "" {
		writeError(w, http.StatusBadRequest, "orgId and id are required")
		return
	}

	if a.db != nil {
		res, err := a.db.Exec(`DELETE FROM leave_requests WHERE id = $1 AND org_id = $2`, reqID, orgID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not delete leave request")
			return
		}
		if rows, _ := res.RowsAffected(); rows == 0 {
			writeError(w, http.StatusNotFound, "leave request not found")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
		return
	}

	a.mu.Lock()
	list := a.leaveRequests[orgID]
	next := list[:0]
	found := false
	for _, item := range list {
		if item.ID == reqID {
			found = true
			continue
		}
		next = append(next, item)
	}
	a.leaveRequests[orgID] = next
	a.mu.Unlock()
	if !found {
		writeError(w, http.StatusNotFound, "leave request not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}
