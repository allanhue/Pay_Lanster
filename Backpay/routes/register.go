package routes

import (
	"github.com/gin-gonic/gin"
)

// Change (mux *http.ServeMux) to (r *gin.Engine)
func (a *App) Register(r *gin.Engine) {
	// Use gin.WrapF to keep using your existing handlers
	r.GET("/health", gin.WrapF(a.health))
	r.POST("/api/auth/signup", gin.WrapF(a.signup))
	r.POST("/api/auth/login", gin.WrapF(a.login))
	r.Any("/api/employees", gin.WrapF(a.employeesHandler))
	r.Any("/api/payruns", gin.WrapF(a.payrunsHandler))
	r.Any("/api/loans", gin.WrapF(a.loansHandler))
	r.Any("/api/benefits", gin.WrapF(a.benefitsHandler))
	r.Any("/api/payslips", gin.WrapF(a.payslipsHandler))
	r.Any("/api/leave-types", gin.WrapF(a.leaveTypesHandler))
	r.Any("/api/leave-requests", gin.WrapF(a.leaveRequestsHandler))
	r.GET("/api/dashboard/org", gin.WrapF(a.orgDashboard))
	r.GET("/api/dashboard/system", gin.WrapF(a.systemDashboard))
	r.GET("/api/analytics/tenants", gin.WrapF(a.tenantAnalytics))
	r.Any("/api/settings", gin.WrapF(a.settingsHandler))
	r.POST("/api/mail/send", gin.WrapF(a.sendMail))
	r.POST("/api/mail/test", gin.WrapF(a.sendMailTest))
	r.POST("/api/support", gin.WrapF(a.supportForm))
	r.Any("/api/approvals", gin.WrapF(a.approvalsHandler))
	r.GET("/api/integrations/project", gin.WrapF(a.projectIntegrationStatus))
	r.GET("/api/integrations/project/report", gin.WrapF(a.projectIntegrationReport))
}
