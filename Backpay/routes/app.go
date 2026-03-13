package routes

import (
	"database/sql"
	"fmt"
	"sync"
)

type UserRole string

const (
	RoleSystemAdmin UserRole = "system_admin"
	RoleOrgAdmin    UserRole = "org_admin"
)

type User struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Email    string   `json:"email"`
	Password string   `json:"-"`
	Role     UserRole `json:"role"`
	OrgID    string   `json:"orgId,omitempty"`
	OrgName  string   `json:"orgName,omitempty"`
}

type Employee struct {
	ID           string  `json:"id"`
	OrgID        string  `json:"orgId"`
	FullName     string  `json:"fullName"`
	Email        string  `json:"email"`
	Department   string  `json:"department"`
	Salary       float64 `json:"salary"`
	PayCycle     string  `json:"payCycle"`
	Status       string  `json:"status"`
	TaxID        string  `json:"taxId"`
	NSSF         string  `json:"nssf"`
	NHIF         string  `json:"nhif"`
	PAYE         string  `json:"paye"`
	BankName     string  `json:"bankName"`
	BankAccount  string  `json:"bankAccount"`
	ContractType string  `json:"contractType"`
	Location     string  `json:"location"`
	HireDate     string  `json:"hireDate"`
}

type OrgSettings struct {
	OrgID       string  `json:"orgId"`
	PayCycle    string  `json:"payCycle"`
	Currency    string  `json:"currency"`
	TaxRate     float64 `json:"taxRate"`
	PensionRate float64 `json:"pensionRate"`
}

type tenantStat struct {
	OrgID          string  `json:"orgId"`
	OrgName        string  `json:"orgName"`
	Employees      int     `json:"employees"`
	MonthlyPayroll float64 `json:"monthlyPayroll"`
}

type signupRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	OrgName  string `json:"orgName"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type App struct {
	db         *sql.DB
	mu         sync.RWMutex
	users      map[string]User
	userByMail map[string]string
	employees  map[string][]Employee
	approvals  map[string][]Approval
	settings   map[string]OrgSettings
	orgNames   map[string]string
	seq        int64
}

func NewApp(db *sql.DB) *App {
	app := &App{
		db:         db,
		users:      make(map[string]User),
		userByMail: make(map[string]string),
		employees:  make(map[string][]Employee),
		approvals:  make(map[string][]Approval),
		settings:   make(map[string]OrgSettings),
		orgNames:   make(map[string]string),
		seq:        1,
	}

	owner := User{
		ID:       "usr_1",
		Name:     "System Owner",
		Email:    "owner@lanster.local",
		Password: "admin123",
		Role:     RoleSystemAdmin,
	}
	app.users[owner.ID] = owner
	app.userByMail[owner.Email] = owner.ID
	app.seq = 2

	return app
}

func (a *App) nextID(prefix string) string {
	id := fmt.Sprintf("%s_%d", prefix, a.seq)
	a.seq++
	return id
}
