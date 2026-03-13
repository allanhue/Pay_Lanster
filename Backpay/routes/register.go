package routes

import "net/http"

func (a *App) Register(mux *http.ServeMux) {
	mux.HandleFunc("/health", a.health)
	mux.HandleFunc("/api/auth/signup", a.signup)
	mux.HandleFunc("/api/auth/login", a.login)
	mux.HandleFunc("/api/employees", a.employeesHandler)
	mux.HandleFunc("/api/dashboard/org", a.orgDashboard)
	mux.HandleFunc("/api/dashboard/system", a.systemDashboard)
	mux.HandleFunc("/api/analytics/tenants", a.tenantAnalytics)
	mux.HandleFunc("/api/settings", a.settingsHandler)
	mux.HandleFunc("/api/mail/send", a.sendMail)
	mux.HandleFunc("/api/mail/test", a.sendMailTest)
	mux.HandleFunc("/api/support", a.supportForm)
}
