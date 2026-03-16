"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api, type Benefit } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

export default function BenefitsAndAllowancesPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Benefit["frequency"]>("Monthly");
  const [taxable, setTaxable] = useState(true);
  const [status, setStatus] = useState<Benefit["status"]>("active");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const router = useRouter();

  const summary = useMemo(() => ({
    total: benefits.length,
    active: benefits.filter((benefit) => benefit.status === "active").length,
    paused: benefits.filter((benefit) => benefit.status === "paused").length,
  }), [benefits]);

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
    api.listBenefits(current.orgId)
      .then((data) => setBenefits(Array.isArray(data) ? data : []))
      .catch(() => setBenefits([]));
  }, [router]);

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.orgId || !name || !amount) return;
    setAdding(true);

    try {
      const created = await api.createBenefit({
        orgId: session.orgId,
        name,
        amount: Number(amount),
        frequency,
        taxable,
        status,
        effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
      });
      setBenefits((prev) => [created, ...prev]);
      setName("");
      setAmount("");
      setTaxable(true);
      setStatus("active");
      setEffectiveDate("");
    } finally {
      setAdding(false);
    }
  };

  const removeBenefit = async (id: string) => {
    if (!session?.orgId) return;
    try {
      await api.deleteBenefit(session.orgId, id);
      setBenefits((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // ignore for now
    }
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
          <p>Define recurring perks and one-off allowances for your team.</p>
        </div>

        <div className="benefit-summary">
          <div className="summary-chip">
            <span>Total</span>
            <strong>{summary.total}</strong>
          </div>
          <div className="summary-chip">
            <span>Active</span>
            <strong>{summary.active}</strong>
          </div>
          <div className="summary-chip">
            <span>Paused</span>
            <strong>{summary.paused}</strong>
          </div>
        </div>

        <div className="benefits-grid">
          <article className="panel panel-elevated benefit-form-panel">
            <div className="panel-header">
              <h2>Configure Allowance</h2>
              <p>Create new perks and define payroll rules.</p>
            </div>
            <form className="form-grid benefit-form" onSubmit={handleAdd}>
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

          <article className="panel panel-elevated benefit-table-panel">
            <div className="panel-header">
              <h2>Configured Perks</h2>
              <p>Review your active and paused benefits.</p>
            </div>
            <table className="data-table benefit-table">
              <thead>
                <tr>
                  <th>Benefit</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                  <th>Taxable</th>
                  <th>Status</th>
                  <th>Effective</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {benefits.map((benefit) => (
                  <tr key={benefit.id}>
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
                    <td className="action-cell">
                      <button
                        className="action-menu-btn"
                        type="button"
                        onClick={() => setActiveMenu(activeMenu === benefit.id ? null : benefit.id)}
                        aria-label="Benefit actions"
                      >
                        <svg viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
                          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                          <circle cx="19" cy="12" r="1.6" fill="currentColor" />
                        </svg>
                      </button>
                      {activeMenu === benefit.id && (
                        <>
                          <button className="popover-backdrop" type="button" onClick={() => setActiveMenu(null)} />
                          <div className="action-popover">
                            <button
                              className="action-popover-item danger"
                              type="button"
                              onClick={() => { removeBenefit(benefit.id); setActiveMenu(null); }}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </td>
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
