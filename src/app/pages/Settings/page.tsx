"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import ModuleActions from "@/app/components/ModuleActions";
import { api, type SettingsPayload } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

type CountryCode = "KE" | "UG" | "TZ" | "RW" | "US" | "GB";
type Item = { name: string; rate: number };

const COUNTRY_CONFIG: Record<
  CountryCode,
  { currency: string; statutory: Item[]; deductions: Item[]; earnings: Item[] }
> = {
  KE: {
    currency: "KES",
    statutory: [{ name: "NSSF", rate: 6 }, { name: "NHIF", rate: 2.75 }, { name: "Housing Levy", rate: 1.5 }],
    deductions: [{ name: "PAYE", rate: 30 }, { name: "Advance Recovery", rate: 2 }],
    earnings: [{ name: "Basic Pay", rate: 100 }, { name: "Transport", rate: 6 }, { name: "Meal", rate: 4 }],
  },
  UG: {
    currency: "UGX",
    statutory: [{ name: "NSSF", rate: 5 }],
    deductions: [{ name: "PAYE", rate: 20 }],
    earnings: [{ name: "Basic Pay", rate: 100 }, { name: "Responsibility", rate: 8 }],
  },
  TZ: {
    currency: "TZS",
    statutory: [{ name: "NSSF", rate: 10 }, { name: "WCF", rate: 1 }],
    deductions: [{ name: "PAYE", rate: 30 }],
    earnings: [{ name: "Basic Pay", rate: 100 }, { name: "Transport", rate: 5 }],
  },
  RW: {
    currency: "RWF",
    statutory: [{ name: "RSSB Pension", rate: 3 }, { name: "RSSB Medical", rate: 0.5 }],
    deductions: [{ name: "PAYE", rate: 30 }],
    earnings: [{ name: "Basic Pay", rate: 100 }, { name: "Communication", rate: 5 }],
  },
  US: {
    currency: "USD",
    statutory: [{ name: "Social Security", rate: 6.2 }, { name: "Medicare", rate: 1.45 }],
    deductions: [{ name: "Federal Tax", rate: 22 }, { name: "State Tax", rate: 5 }],
    earnings: [{ name: "Base Pay", rate: 100 }, { name: "Bonus", rate: 12 }],
  },
  GB: {
    currency: "GBP",
    statutory: [{ name: "National Insurance", rate: 12 }, { name: "Pension Auto-Enrol", rate: 5 }],
    deductions: [{ name: "PAYE", rate: 20 }],
    earnings: [{ name: "Base Pay", rate: 100 }, { name: "Allowance", rate: 7 }],
  },
};

const DEFAULT_SETTINGS: Omit<SettingsPayload, "orgId"> = {
  payCycle: "monthly",
  currency: "USD",
  taxRate: 20,
  pensionRate: 5,
};

export default function SettingsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [country, setCountry] = useState<CountryCode>("KE");
  const [entityName, setEntityName] = useState("");
  const [entityTaxId, setEntityTaxId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"entity" | "payroll" | "deductions">("entity");
  const router = useRouter();

  const countryPreset = useMemo(() => COUNTRY_CONFIG[country], [country]);

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    if (current.role !== "org_admin" || !current.orgId) {
      router.replace("/system_admin/Configuration");
      return;
    }

    setSession(current);
    setEntityName(current.orgName ?? "");
    void api
      .getSettings(current.orgId)
      .then((saved) => {
        setSettings({
          payCycle: saved.payCycle,
          currency: saved.currency,
          taxRate: saved.taxRate,
          pensionRate: saved.pensionRate,
        });
      })
      .catch(() => {
        // Keep defaults for a new tenant.
      });
  }, [router]);

  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      currency: countryPreset.currency,
      taxRate: countryPreset.deductions[0]?.rate ?? prev.taxRate,
      pensionRate: countryPreset.statutory[0]?.rate ?? prev.pensionRate,
    }));
  }, [countryPreset]);

  const onSave = async () => {
    if (!session?.orgId) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await api.saveSettings({ orgId: session.orgId, ...settings });
      setMessage("Payroll setup saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!session) return <main className="centered">Loading...</main>;

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <div className="page-header">
          <div className="page-header-content">
            <h1>Payroll Setup</h1>
            <p>Configure your organization profile, statutory deductions, and payroll settings for {session.orgName}.</p>
          </div>
          <ModuleActions />
        </div>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {/* Tab Navigation */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "entity" ? "active" : ""}`}
            onClick={() => setActiveTab("entity")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 21h18M5 21V7l8-4 8 4M9 21v-6h6v6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Entity Profile
          </button>
          <button
            className={`tab ${activeTab === "payroll" ? "active" : ""}`}
            onClick={() => setActiveTab("payroll")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 7v5l3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Payroll Settings
          </button>
          <button
            className={`tab ${activeTab === "deductions" ? "active" : ""}`}
            onClick={() => setActiveTab("deductions")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 14l2 2 4-4M7 12l2-2 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Deductions & Statutories
          </button>
        </div>

        {/* Entity Profile Tab */}
        {activeTab === "entity" && (
          <div className="panel panel-elevated">
            <div className="panel-header">
              <h2>Organization Details</h2>
              <p>Legal entity information for compliance and reporting</p>
            </div>
            <div className="form-grid form-two-col">
              <div className="form-group">
                <label htmlFor="entityName">Legal Entity Name</label>
                <input
                  id="entityName"
                  type="text"
                  placeholder="e.g., Acme Logistics Ltd"
                  onChange={(e) => setEntityName(e.target.value)}
                  value={entityName}
                />
              </div>
              <div className="form-group">
                <label htmlFor="entityTax">Tax Registration Number</label>
                <input
                  id="entityTax"
                  type="text"
                  placeholder="e.g., PAYER-001"
                  onChange={(e) => setEntityTaxId(e.target.value)}
                  value={entityTaxId}
                />
              </div>
              <div className="form-group">
                <label htmlFor="country">Country / Region</label>
                <select
                  id="country"
                  onChange={(e) => setCountry(e.target.value as CountryCode)}
                  value={country}
                >
                  <option value="KE">Kenya</option>
                  <option value="UG">Uganda</option>
                  <option value="TZ">Tanzania</option>
                  <option value="RW">Rwanda</option>
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                </select>
                <span className="form-hint">Statutory defaults auto-load based on selection</span>
              </div>
              <div className="form-group">
                <label htmlFor="currency">Base Currency</label>
                <input
                  id="currency"
                  type="text"
                  onChange={(e) => setSettings((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                  value={settings.currency}
                />
              </div>
            </div>
          </div>
        )}

        {/* Payroll Settings Tab */}
        {activeTab === "payroll" && (
          <div className="panel panel-elevated">
            <div className="panel-header">
              <h2>Payroll Configuration</h2>
              <p>Payment cycles and default rates</p>
            </div>
            <div className="form-grid form-two-col">
              <div className="form-group">
                <label htmlFor="payCycle">Pay Cycle</label>
                <select
                  id="payCycle"
                  onChange={(e) => setSettings((prev) => ({ ...prev, payCycle: e.target.value as "monthly" | "biweekly" }))}
                  value={settings.payCycle}
                >
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Biweekly</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="tax">Primary Income Tax Rate (%)</label>
                <div className="input-with-suffix">
                  <input
                    id="tax"
                    type="number"
                    min="0"
                    max="100"
                    onChange={(e) => setSettings((prev) => ({ ...prev, taxRate: Number(e.target.value) }))}
                    value={settings.taxRate}
                  />
                  <span className="input-suffix">%</span>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="pension">Pension / Retirement Rate (%)</label>
                <div className="input-with-suffix">
                  <input
                    id="pension"
                    type="number"
                    min="0"
                    max="100"
                    onChange={(e) => setSettings((prev) => ({ ...prev, pensionRate: Number(e.target.value) }))}
                    value={settings.pensionRate}
                  />
                  <span className="input-suffix">%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deductions Tab */}
        {activeTab === "deductions" && (
          <>
            <div className="cards-grid three-col">
              <div className="card card-stat">
                <div className="card-header">
                  <span className="card-icon stat-icon">E</span>
                  <h3>Earnings</h3>
                </div>
                <ul className="stat-list">
                  {countryPreset.earnings.map((item) => (
                    <li key={`earning-${item.name}`} className="stat-item">
                      <span className="stat-name">{item.name}</span>
                      <span className="stat-value">{item.rate}%</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card card-stat">
                <div className="card-header">
                  <span className="card-icon deduct-icon">D</span>
                  <h3>Deductions</h3>
                </div>
                <ul className="stat-list">
                  {countryPreset.deductions.map((item) => (
                    <li key={`deduction-${item.name}`} className="stat-item">
                      <span className="stat-name">{item.name}</span>
                      <span className="stat-value">{item.rate}%</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card card-stat">
                <div className="card-header">
                  <span className="card-icon statutory-icon">S</span>
                  <h3>Statutories</h3>
                </div>
                <ul className="stat-list">
                  {countryPreset.statutory.map((item) => (
                    <li key={`statutory-${item.name}`} className="stat-item">
                      <span className="stat-name">{item.name}</span>
                      <span className="stat-value">{item.rate}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="panel panel-info">
              <div className="info-header">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 16v-4M12 8h.01" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <h4>Statutory Configuration</h4>
              </div>
              <p>These values are pre-configured based on your selected country ({country}). To customize statutory rates, contact support or update your country selection above.</p>
            </div>
          </>
        )}

        <div className="form-actions">
          <button
            className={`btn btn-primary ${saving ? "btn-loading" : ""}`}
            disabled={saving}
            onClick={onSave}
            type="button"
          >
            {saving && <span className="btn-spinner" />}
            {saving ? "Saving..." : "Save Payroll Setup"}
          </button>
        </div>
      </section>
    </main>
  );
}
