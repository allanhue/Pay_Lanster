package routes

import "net/http"

type demoData struct {
	Loans    []demoLoan     `json:"loans"`
	Benefits []demoBenefit  `json:"benefits"`
	Payslips []demoPayslip  `json:"payslips"`
	Reports  []demoReport   `json:"reports"`
	Calendar []demoCalendar `json:"calendar"`
}

type demoLoan struct {
	ID          string  `json:"id"`
	Employee    string  `json:"employee"`
	Amount      float64 `json:"amount"`
	Outstanding float64 `json:"outstanding"`
	NextPayment string  `json:"nextPayment"`
	Status      string  `json:"status"`
}

type demoBenefit struct {
	Name          string  `json:"name"`
	Amount        float64 `json:"amount"`
	Frequency     string  `json:"frequency"`
	Taxable       bool    `json:"taxable"`
	Status        string  `json:"status"`
	EffectiveDate string  `json:"effectiveDate"`
}

type demoPayslip struct {
	ID         string  `json:"id"`
	Employee   string  `json:"employee"`
	Email      string  `json:"email"`
	Period     string  `json:"period"`
	Gross      float64 `json:"gross"`
	Deductions float64 `json:"deductions"`
	Net        float64 `json:"net"`
	Approval   string  `json:"approval"`
}

type demoReport struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Period    string `json:"period"`
	Category  string `json:"category"`
	Status    string `json:"status"`
	UpdatedAt string `json:"updatedAt"`
}

type demoCalendar struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Date        string `json:"date"`
	Time        string `json:"time"`
	Type        string `json:"type"`
	Status      string `json:"status"`
}

func (a *App) demoData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	payload := demoData{
		Loans: []demoLoan{
			{ID: "LN-2034", Employee: "Jane Adams", Amount: 5400, Outstanding: 1600, NextPayment: "Apr 28", Status: "open"},
			{ID: "LN-2035", Employee: "Mark Ellis", Amount: 12000, Outstanding: 4000, NextPayment: "May 05", Status: "paused"},
			{ID: "LN-2036", Employee: "Lena Ortiz", Amount: 3200, Outstanding: 0, NextPayment: "-", Status: "settled"},
		},
		Benefits: []demoBenefit{
			{Name: "Transport Allowance", Amount: 150, Frequency: "Monthly", Taxable: true, Status: "active", EffectiveDate: "2026-01-01"},
			{Name: "Meal Allowance", Amount: 90, Frequency: "Monthly", Taxable: false, Status: "active", EffectiveDate: "2026-02-15"},
			{Name: "Wellness Support", Amount: 280, Frequency: "Annual", Taxable: false, Status: "paused", EffectiveDate: "2025-11-01"},
		},
		Payslips: []demoPayslip{
			{ID: "PS-1201", Employee: "Jane Adams", Email: "jane.adams@company.com", Period: "Apr 2026", Gross: 5200, Deductions: 980, Net: 4220, Approval: "pending"},
			{ID: "PS-1202", Employee: "Mark Ellis", Email: "mark.ellis@company.com", Period: "Apr 2026", Gross: 6100, Deductions: 1245, Net: 4855, Approval: "approved"},
			{ID: "PS-1203", Employee: "Lena Ortiz", Email: "lena.ortiz@company.com", Period: "Apr 2026", Gross: 4700, Deductions: 920, Net: 3780, Approval: "pending"},
		},
		Reports: []demoReport{
			{ID: "RP-101", Title: "Monthly Payroll Summary", Period: "April 2026", Category: "Payroll", Status: "ready", UpdatedAt: "Apr 28, 2026"},
			{ID: "RP-102", Title: "PAYE & Statutory Remittance", Period: "April 2026", Category: "Compliance", Status: "ready", UpdatedAt: "Apr 28, 2026"},
			{ID: "RP-103", Title: "Loans & Advances Overview", Period: "Q1 2026", Category: "Finance", Status: "draft", UpdatedAt: "Apr 15, 2026"},
		},
		Calendar: []demoCalendar{
			{ID: "evt_001", Title: "Monthly Payroll Processing", Description: "Process March 2026 payroll for all employees", Date: "2026-03-31", Time: "09:00 AM", Type: "payroll", Status: "upcoming"},
			{ID: "evt_002", Title: "Payroll Deadline", Description: "Final deadline for March payroll submissions", Date: "2026-03-25", Time: "05:00 PM", Type: "deadline", Status: "upcoming"},
			{ID: "evt_003", Title: "Team Meeting", Description: "Monthly team sync and performance review", Date: "2026-03-28", Time: "02:00 PM", Type: "meeting", Status: "upcoming"},
			{ID: "evt_004", Title: "Good Friday", Description: "Public holiday - Office closed", Date: "2026-04-18", Time: "All Day", Type: "holiday", Status: "upcoming"},
			{ID: "evt_005", Title: "Benefits Enrollment Reminder", Description: "Reminder for open enrollment period", Date: "2026-03-22", Time: "10:00 AM", Type: "reminder", Status: "upcoming"},
		},
	}

	writeJSON(w, http.StatusOK, payload)
}
