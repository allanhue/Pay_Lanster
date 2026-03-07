package main

import (
  "database/sql"
  "os"

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
