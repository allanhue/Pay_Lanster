package routes

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

type projectIntegrationStatus struct {
	BaseURL   string `json:"baseUrl"`
	Enabled   bool   `json:"enabled"`
	Message   string `json:"message"`
	Connected bool   `json:"connected"`
}

type projectReportRequest struct {
	OrgID     string `json:"orgId"`
	Period    string `json:"period"`
	ReportURL string `json:"reportUrl"`
	Summary   string `json:"summary"`
}

func (a *App) projectIntegrationStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	baseURL := strings.TrimSpace(os.Getenv("PROJECT_APP"))
	if baseURL == "" {
		writeJSON(w, http.StatusOK, projectIntegrationStatus{
			BaseURL:   "",
			Enabled:   false,
			Connected: false,
			Message:   "PROJECT_APP is not configured yet",
		})
		return
	}

	writeJSON(w, http.StatusOK, projectIntegrationStatus{
		BaseURL:   baseURL,
		Enabled:   true,
		Connected: true,
		Message:   "Project manager integration is configured",
	})
}

func (a *App) projectIntegrationReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req projectReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if strings.TrimSpace(req.OrgID) == "" || strings.TrimSpace(req.Period) == "" {
		writeError(w, http.StatusBadRequest, "orgId and period are required")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"queued":  true,
		"message": "project report queued for integration (stub)",
	})
}
