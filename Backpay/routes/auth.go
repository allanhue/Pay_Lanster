package routes

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func (a *App) signup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req signupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Name == "" || req.Email == "" || req.Password == "" || req.OrgName == "" {
		writeError(w, http.StatusBadRequest, "all signup fields are required")
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	// Check if email exists in database
	if a.db != nil {
		var existingID string
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		err := a.db.QueryRowContext(ctx, `SELECT id FROM users WHERE email = $1`, req.Email).Scan(&existingID)
		if err != sql.ErrNoRows && err != nil {
			writeError(w, http.StatusInternalServerError, "database error")
			return
		}
		if err == nil {
			writeError(w, http.StatusConflict, "email already exists")
			return
		}
	} else {
		if _, exists := a.userByMail[req.Email]; exists {
			writeError(w, http.StatusConflict, "email already exists")
			return
		}
	}

	orgID := a.nextID("org")
	userID := a.nextID("usr")

	// Save to database if connected
	if a.db != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		_, err := a.db.ExecContext(ctx, `INSERT INTO organizations (id, name) VALUES ($1, $2)`, orgID, req.OrgName)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not create organization")
			return
		}

		_, err = a.db.ExecContext(
			ctx,
			`INSERT INTO users (id, org_id, name, email, password, role) VALUES ($1, $2, $3, $4, $5, $6)`,
			userID, orgID, req.Name, req.Email, req.Password, RoleOrgAdmin,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not create user")
			return
		}

		_, err = a.db.ExecContext(
			ctx,
			`INSERT INTO org_settings (org_id, pay_cycle, currency, tax_rate, pension_rate) VALUES ($1, $2, $3, $4, $5)`,
			orgID, "monthly", "USD", 20, 5,
		)
		if err != nil {
			// Non-fatal, just log
			println("failed to insert org_settings:", err.Error())
		}
	}

	user := User{
		ID:       userID,
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
		Role:     RoleOrgAdmin,
		OrgID:    orgID,
		OrgName:  req.OrgName,
	}

	a.users[userID] = user
	a.userByMail[user.Email] = userID
	a.orgNames[orgID] = req.OrgName
	a.settings[orgID] = OrgSettings{
		OrgID:       orgID,
		PayCycle:    "monthly",
		Currency:    "USD",
		TaxRate:     20,
		PensionRate: 5,
	}

	writeJSON(w, http.StatusCreated, user)
}

func (a *App) login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	// Check database first if connected
	if a.db != nil {
		var user User
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		err := a.db.QueryRowContext(
			ctx,
			`SELECT id, org_id, name, email, password, role FROM users WHERE email = $1`,
			email,
		).Scan(&user.ID, &user.OrgID, &user.Name, &user.Email, &user.Password, &user.Role)
		if err == sql.ErrNoRows {
			writeError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database error")
			return
		}
		if user.Password != req.Password {
			writeError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		// Get org name
		_ = a.db.QueryRowContext(ctx, `SELECT name FROM organizations WHERE id = $1`, user.OrgID).Scan(&user.OrgName)
		writeJSON(w, http.StatusOK, user)
		return
	}

	// Fallback to memory
	a.mu.RLock()
	defer a.mu.RUnlock()

	userID, exists := a.userByMail[email]
	if !exists {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	user := a.users[userID]
	if user.Password != req.Password {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	writeJSON(w, http.StatusOK, user)
}
