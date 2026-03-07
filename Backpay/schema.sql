CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  full_name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  salary NUMERIC NOT NULL,
  pay_cycle TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payruns (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  period TEXT,
  payday DATE,
  net_payroll NUMERIC,
  employees INT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  employee TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  outstanding NUMERIC NOT NULL,
  next_payment DATE,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS benefits (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  name TEXT NOT NULL,
  amount NUMERIC,
  frequency TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  module TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  requested_by TEXT,
  status TEXT DEFAULT 'pending',
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payslips (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  employee_name TEXT NOT NULL,
  period TEXT NOT NULL,
  gross_pay NUMERIC NOT NULL,
  deductions NUMERIC NOT NULL,
  net_pay NUMERIC NOT NULL,
  approval_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_settings (
  org_id TEXT PRIMARY KEY REFERENCES organizations(id),
  country_code TEXT DEFAULT 'KE',
  entity_name TEXT,
  entity_tax_id TEXT,
  pay_cycle TEXT,
  currency TEXT,
  tax_rate NUMERIC,
  pension_rate NUMERIC
);
