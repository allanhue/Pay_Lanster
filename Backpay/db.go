package main

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

const (
	ownerOrgID  = "org_root"
	ownerUserID = "usr_1"
	ownerEmail  = "owner@lanster.local"
	ownerRole   = "system_admin"
)

func databaseURL() string {
	return os.Getenv("NEON_DATABASE_URL")
}

func connectDatabase() (*sql.DB, error) {
	url := databaseURL()
	if url == "" {
		return nil, nil
	}

	db, err := sql.Open("pgx", url)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}

	if err := InitSchema(db); err != nil {
		db.Close()
		return nil, err
	}

	if err := seedOwner(db); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}

func InitSchema(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
		`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      org_id TEXT REFERENCES organizations(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
		`CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      org_id TEXT REFERENCES organizations(id),
      full_name TEXT NOT NULL,
      email TEXT,
      department TEXT,
      salary NUMERIC NOT NULL,
      pay_cycle TEXT,
      status TEXT DEFAULT 'active',
      tax_id TEXT,
      nssf TEXT,
      nhif TEXT,
      paye TEXT,
      bank_name TEXT,
      bank_account TEXT,
      contract_type TEXT,
      location TEXT,
      hire_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
		`CREATE TABLE IF NOT EXISTS payruns (
      id TEXT PRIMARY KEY,
      org_id TEXT REFERENCES organizations(id),
      period TEXT,
      payday DATE,
      net_payroll NUMERIC,
      employees INT,
      status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
		`CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      org_id TEXT REFERENCES organizations(id),
      employee TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      outstanding NUMERIC NOT NULL,
      next_payment DATE,
      status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
		`CREATE TABLE IF NOT EXISTS benefits (
      id TEXT PRIMARY KEY,
      org_id TEXT REFERENCES organizations(id),
      name TEXT NOT NULL,
      amount NUMERIC,
      frequency TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
		`CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      org_id TEXT REFERENCES organizations(id),
      module TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      requested_by TEXT,
      status TEXT DEFAULT 'pending',
      decided_by TEXT,
      decided_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
		`CREATE TABLE IF NOT EXISTS payslips (
      id TEXT PRIMARY KEY,
      org_id TEXT REFERENCES organizations(id),
      employee_name TEXT NOT NULL,
      period TEXT NOT NULL,
      gross_pay NUMERIC NOT NULL,
      deductions NUMERIC NOT NULL,
      net_pay NUMERIC NOT NULL,
      approval_status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
		`CREATE TABLE IF NOT EXISTS org_settings (
      org_id TEXT PRIMARY KEY REFERENCES organizations(id),
      country_code TEXT DEFAULT 'KE',
      entity_name TEXT,
      entity_tax_id TEXT,
      pay_cycle TEXT,
      currency TEXT,
      tax_rate NUMERIC,
      pension_rate NUMERIC
    )`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	alterStatements := []string{
		`ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_id TEXT`,
		`ALTER TABLE employees ADD COLUMN IF NOT EXISTS nssf TEXT`,
		`ALTER TABLE employees ADD COLUMN IF NOT EXISTS nhif TEXT`,
		`ALTER TABLE employees ADD COLUMN IF NOT EXISTS paye TEXT`,
		`ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name TEXT`,
		`ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account TEXT`,
		`ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT`,
		`ALTER TABLE employees ADD COLUMN IF NOT EXISTS location TEXT`,
		`ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE`,
	}
	for _, stmt := range alterStatements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	return nil
}

func seedOwner(db *sql.DB) error {
	if _, err := db.Exec(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, ownerOrgID, "Payroll Lanster"); err != nil {
		return err
	}

	if _, err := db.Exec(
		`INSERT INTO users (id, org_id, name, email, password, role) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
		ownerUserID,
		ownerOrgID,
		"System Owner",
		ownerEmail,
		"admin123",
		ownerRole,
	); err != nil {
		return err
	}

	return nil
}

func SeedDemoData(db *sql.DB) error {
	if db == nil {
		return fmt.Errorf("database not configured")
	}

	orgID := "org_demo_acme"
	if _, err := db.Exec(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, orgID, "Acme Logistics Ltd"); err != nil {
		return err
	}

	if _, err := db.Exec(
		`INSERT INTO users (id, org_id, name, email, password, role) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
		"usr_demo_admin",
		orgID,
		"Acme Org Admin",
		"admin@acme.test",
		"admin123",
		"org_admin",
	); err != nil {
		return err
	}

	employees := []struct {
		id, name, email, dept, cycle string
		salary                       int
	}{
		{"emp_demo_1", "Jane Adams", "jane@acme.test", "Operations", "monthly", 62000},
		{"emp_demo_2", "Mark Ellis", "mark@acme.test", "Engineering", "monthly", 75000},
		{"emp_demo_3", "Lena Ortiz", "lena@acme.test", "Finance", "biweekly", 68000},
		{"emp_demo_4", "Raj Patel", "raj@acme.test", "Operations", "monthly", 59000},
		{"emp_demo_5", "Anna Kim", "anna@acme.test", "HR", "biweekly", 61000},
	}

	for _, employee := range employees {
		if _, err := db.Exec(
			`INSERT INTO employees (id, org_id, full_name, email, department, salary, pay_cycle, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'active') ON CONFLICT DO NOTHING`,
			employee.id, orgID, employee.name, employee.email, employee.dept, employee.salary, employee.cycle,
		); err != nil {
			return err
		}
	}

	if _, err := db.Exec(
		`INSERT INTO payruns (id, org_id, period, payday, net_payroll, employees, status) VALUES
      ('pr_demo_1', $1, 'Mar 2026', CURRENT_DATE - INTERVAL '30 days', 178900, 5, 'completed'),
      ('pr_demo_2', $1, 'Apr 2026', CURRENT_DATE, 184200, 5, 'approved')
     ON CONFLICT DO NOTHING`,
		orgID,
	); err != nil {
		return err
	}

	if _, err := db.Exec(
		`INSERT INTO loans (id, org_id, employee, amount, outstanding, next_payment, status) VALUES
      ('ln_demo_1', $1, 'Mark Ellis', 12000, 4000, CURRENT_DATE + INTERVAL '15 days', 'open'),
      ('ln_demo_2', $1, 'Jane Adams', 5400, 1600, CURRENT_DATE + INTERVAL '20 days', 'open')
     ON CONFLICT DO NOTHING`,
		orgID,
	); err != nil {
		return err
	}

	if _, err := db.Exec(
		`INSERT INTO benefits (id, org_id, name, amount, frequency) VALUES
      ('bf_demo_1', $1, 'Transport Allowance', 150, 'Monthly'),
      ('bf_demo_2', $1, 'Meal Allowance', 90, 'Monthly')
     ON CONFLICT DO NOTHING`,
		orgID,
	); err != nil {
		return err
	}

	if _, err := db.Exec(
		`INSERT INTO payslips (id, org_id, employee_name, period, gross_pay, deductions, net_pay, approval_status) VALUES
      ('ps_demo_1', $1, 'Jane Adams', 'Apr 2026', 5200, 980, 4220, 'pending'),
      ('ps_demo_2', $1, 'Mark Ellis', 'Apr 2026', 6100, 1245, 4855, 'approved')
     ON CONFLICT DO NOTHING`,
		orgID,
	); err != nil {
		return err
	}

	now := time.Now()
	if _, err := db.Exec(
		`INSERT INTO approvals (id, org_id, module, reference_id, requested_by, status, decided_by, decided_at) VALUES
      ('ap_demo_1', $1, 'payrun', 'pr_demo_2', 'Acme Org Admin', 'pending', NULL, NULL),
      ('ap_demo_2', $1, 'payslip', 'ps_demo_1', 'Acme Org Admin', 'pending', NULL, NULL),
      ('ap_demo_3', $1, 'payslip', 'ps_demo_2', 'Acme Org Admin', 'approved', 'System Owner', $2)
     ON CONFLICT DO NOTHING`,
		orgID, now,
	); err != nil {
		return err
	}

	if _, err := db.Exec(
		`INSERT INTO org_settings (org_id, country_code, entity_name, entity_tax_id, pay_cycle, currency, tax_rate, pension_rate)
     VALUES ($1, 'KE', 'Acme Logistics Ltd', 'PAYER-001', 'monthly', 'KES', 30, 6)
     ON CONFLICT (org_id) DO UPDATE SET
       country_code = EXCLUDED.country_code,
       entity_name = EXCLUDED.entity_name,
       entity_tax_id = EXCLUDED.entity_tax_id,
       pay_cycle = EXCLUDED.pay_cycle,
       currency = EXCLUDED.currency,
       tax_rate = EXCLUDED.tax_rate,
       pension_rate = EXCLUDED.pension_rate`,
		orgID,
	); err != nil {
		return err
	}

	return nil
}
