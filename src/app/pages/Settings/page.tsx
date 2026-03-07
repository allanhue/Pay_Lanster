"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
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
      setMessage("Payroll setup, entity, and statutory defaults saved.");
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
        <h1>Payroll Setup</h1>
        <p>Configure entity profile, country statutes, earnings and deductions for {session.orgName}.</p>

        {message && <div className="success-text">{message}</div>}
        {error && <div className="error-text">{error}</div>}

        <article className="panel form-grid">
          <h2>Entity Profile</h2>
          <label htmlFor="entityName">Legal entity name</label>
          <input id="entityName" onChange={(e) => setEntityName(e.target.value)} value={entityName} />
          <label htmlFor="entityTax">Tax registration number</label>
          <input id="entityTax" onChange={(e) => setEntityTaxId(e.target.value)} value={entityTaxId} />
        </article>

        <article className="panel form-grid">
          <h2>Country and Statutory Rules</h2>
          <label htmlFor="country">Country</label>
          <select id="country" onChange={(e) => setCountry(e.target.value as CountryCode)} value={country}>
            <option value="KE">Kenya</option>
            <option value="UG">Uganda</option>
            <option value="TZ">Tanzania</option>
            <option value="RW">Rwanda</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
          </select>
          <label htmlFor="payCycle">Pay cycle</label>
          <select
            id="payCycle"
            onChange={(e) => setSettings((prev) => ({ ...prev, payCycle: e.target.value as "monthly" | "biweekly" }))}
            value={settings.payCycle}
          >
            <option value="monthly">Monthly</option>
            <option value="biweekly">Biweekly</option>
          </select>
          <label htmlFor="currency">Currency</label>
          <input id="currency" onChange={(e) => setSettings((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} value={settings.currency} />
          <label htmlFor="tax">Primary tax rate (%)</label>
          <input id="tax" onChange={(e) => setSettings((prev) => ({ ...prev, taxRate: Number(e.target.value) }))} type="number" value={settings.taxRate} />
          <label htmlFor="pension">Primary pension rate (%)</label>
          <input id="pension" onChange={(e) => setSettings((prev) => ({ ...prev, pensionRate: Number(e.target.value) }))} type="number" value={settings.pensionRate} />
        </article>

        <div className="cards-grid">
          <article className="panel">
            <h2>Earnings</h2>
            <ul className="simple-list">
              {countryPreset.earnings.map((item) => (
                <li key={`earning-${item.name}`}>
                  <span>{item.name}</span>
                  <span>{item.rate}%</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="panel">
            <h2>Deductions</h2>
            <ul className="simple-list">
              {countryPreset.deductions.map((item) => (
                <li key={`deduction-${item.name}`}>
                  <span>{item.name}</span>
                  <span>{item.rate}%</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="panel">
            <h2>Statutories</h2>
            <ul className="simple-list">
              {countryPreset.statutory.map((item) => (
                <li key={`statutory-${item.name}`}>
                  <span>{item.name}</span>
                  <span>{item.rate}%</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <button className={saving ? "btn-loading" : ""} disabled={saving} onClick={onSave} type="button">
          {saving && <span className="btn-spinner" />}
          {saving ? "Saving..." : "Save Payroll Setup"}
        </button>
      </section>
    </main>
  );
}
