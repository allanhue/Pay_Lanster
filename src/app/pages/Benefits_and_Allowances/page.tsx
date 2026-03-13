"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

type Benefit = {
  name: string;
  amount: number;
  frequency: "Monthly" | "One-time" | "Annual";
  taxable: boolean;
  status: "active" | "paused";
  effectiveDate: string;
};

const defaults: Benefit[] = [
  { name: "Transport Allowance", amount: 150, frequency: "Monthly", taxable: true, status: "active", effectiveDate: "2026-01-01" },
  { name: "Meal Allowance", amount: 90, frequency: "Monthly", taxable: false, status: "active", effectiveDate: "2026-02-15" },
  { name: "Wellness Support", amount: 280, frequency: "Annual", taxable: false, status: "paused", effectiveDate: "2025-11-01" },
];

export default function BenefitsAndAllowancesPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [benefits, setBenefits] = useState<Benefit[]>(defaults);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Benefit["frequency"]>("Monthly");
  const [taxable, setTaxable] = useState(true);
  const [status, setStatus] = useState<Benefit["status"]>("active");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    if (current.role !== "org_admin") {
      router.replace("/system_admin/Dasboard");
      return;
    }
    setSession(current);
  }, [router]);

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!name || !amount) return;
    setAdding(true);

    setBenefits((prev) => [
      ...prev,
      { name, amount: Number(amount), frequency, taxable, status, effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10) },
    ]);
    setName("");
    setAmount("");
    setTaxable(true);
    setStatus("active");
    setEffectiveDate("");
    setTimeout(() => setAdding(false), 250);
  };

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide">
        <div className="page-header">
          <h1>Benefits & Allowances</h1>
          <p>Design perks that flow directly into payroll calculations.</p>
        </div>

        <div className="cards-grid three-col">
          <article className="card card-metric">
            <span className="metric-label">Active Benefits</span>
            <span className="metric-value">{benefits.filter((item) => item.status === "active").length}</span>
            <span className="metric-sublabel">Currently applied</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Taxable Benefits</span>
            <span className="metric-value">{benefits.filter((item) => item.taxable).length}</span>
            <span className="metric-sublabel">Included in PAYE</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Monthly Allowances</span>
            <span className="metric-value">{benefits.filter((item) => item.frequency === "Monthly").length}</span>
            <span className="metric-sublabel">Recurring payouts</span>
          </article>
        </div>

        <div className="split-grid">
          <article className="panel panel-elevated">
            <div className="panel-header">
              <h2>Configure Allowance</h2>
              <p>Create new perks and define payroll rules.</p>
            </div>
            <form className="form-grid" onSubmit={handleAdd}>
              <div className="form-group">
                <label htmlFor="benefit-name">Benefit name</label>
                <input
                  id="benefit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Learning stipend"
                  required
                />
              </div>

              <div className="form-group form-two-col">
                <div className="form-group">
                  <label htmlFor="benefit-amount">Amount</label>
                  <input
                    id="benefit-amount"
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="benefit-frequency">Frequency</label>
                  <select
                    id="benefit-frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as Benefit["frequency"])}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="One-time">One-time</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
              </div>

              <div className="form-group form-two-col">
                <div className="form-group">
                  <label htmlFor="benefit-status">Status</label>
                  <select id="benefit-status" value={status} onChange={(e) => setStatus(e.target.value as Benefit["status"])}>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="benefit-effective">Effective Date</label>
                  <input
                    id="benefit-effective"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group checkbox-row">
                <label className="checkbox-label">
                  <input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} />
                  <span className="checkbox-text">Taxable benefit (included in PAYE)</span>
                </label>
              </div>

              <div className="form-actions">
                <button className="btn btn-secondary" type="button" onClick={() => { setName(""); setAmount(""); }}>
                  Reset
                </button>
                <button className={`btn btn-primary ${adding ? "btn-loading" : ""}`} disabled={adding} type="submit">
                  {adding && <span className="btn-spinner" />}
                  {adding ? "Adding..." : "Add benefit"}
                </button>
              </div>
            </form>
          </article>

          <article className="panel panel-elevated">
            <div className="panel-header">
              <h2>Configured Perks</h2>
              <p>Review your active and paused benefits.</p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Benefit</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                  <th>Taxable</th>
                  <th>Status</th>
                  <th>Effective</th>
                </tr>
              </thead>
              <tbody>
                {benefits.map((benefit) => (
                  <tr key={`${benefit.name}-${benefit.frequency}`}>
                    <td>{benefit.name}</td>
                    <td>
                      {benefit.amount.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                    <td>{benefit.frequency}</td>
                    <td>{benefit.taxable ? "Yes" : "No"}</td>
                    <td>
                      <span className={`status-badge status-${benefit.status}`}>{benefit.status}</span>
                    </td>
                    <td>{benefit.effectiveDate || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      </section>
    </main>
  );
}
