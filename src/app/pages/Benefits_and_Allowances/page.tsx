"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import ModuleActions from "@/app/components/ModuleActions";
import { api, type Benefit } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

const FREQUENCIES: Benefit["frequency"][] = ["Monthly", "One-time", "Annual"];
const STATUSES: Benefit["status"][] = ["active", "paused"];

const defaultForm = {
  name: "",
  amount: "",
  frequency: "Monthly" as Benefit["frequency"],
  taxable: true,
  status: "active" as Benefit["status"],
  effectiveDate: "",
};

export default function BenefitsAndAllowancesPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [adding, setAdding] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const summary = useMemo(
    () => ({
      total: benefits.length,
      active: benefits.filter((b) => b.status === "active").length,
      paused: benefits.filter((b) => b.status === "paused").length,
    }),
    [benefits]
  );

  useEffect(() => {
    const current = readSession();
    if (!current) { router.replace("/auth/login"); return; }
    if (current.role !== "org_admin") { router.replace("/system_admin/Dashboard"); return; }
    setSession(current);
    if (current.orgId) {
      api.listBenefits(current.orgId)
        .then((data) => setBenefits(Array.isArray(data) ? data : []))
        .catch(() => setBenefits([]));
    }
  }, [router]);

  const setField = <K extends keyof typeof defaultForm>(key: K, value: typeof defaultForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.orgId || !form.name || !form.amount) return;
    setAdding(true);
    try {
      const created = await api.createBenefit({
        orgId: session.orgId,
        name: form.name,
        amount: Number(form.amount),
        frequency: form.frequency,
        taxable: form.taxable,
        status: form.status,
        effectiveDate: form.effectiveDate || new Date().toISOString().slice(0, 10),
      });
      setBenefits((prev) => [created, ...prev]);
      setForm(defaultForm);
    } finally {
      setAdding(false);
    }
  };

  const removeBenefit = async (id: string) => {
    if (!session?.orgId) return;
    try {
      await api.deleteBenefit(session.orgId, id);
      setBenefits((prev) => prev.filter((b) => b.id !== id));
    } catch {
      // handle silently
    }
  };

  if (!session) return <main className="centered">Loading…</main>;

  return (
    <main className="page-shell">
      <Navbar session={session} />

      <section className="content content-wide">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-content">
            <h1>Benefits & Allowances</h1>
            <p>Define recurring perks and one-off allowances for your team.</p>
          </div>
          <ModuleActions />
        </div>

        {/* Summary chips */}
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

        <div className="benefit-toggle-row">
          <button
            className={`btn ${showReport ? "btn-secondary" : "btn-primary"}`}
            type="button"
            onClick={() => setShowReport(false)}
          >
            Add Benefit
          </button>
          <button
            className={`btn ${showReport ? "btn-primary" : "btn-secondary"}`}
            type="button"
            onClick={() => setShowReport(true)}
          >
            View Report
          </button>
        </div>

        <div className="benefits-stack">
          {!showReport && (
            <article className="panel panel-elevated benefit-form-panel">
              <div className="panel-header">
                <h2>Configure Allowance</h2>
                <p>Create new perks and define payroll rules.</p>
              </div>

              <form className="benefit-form" onSubmit={handleAdd}>
                <div className="form-group">
                  <label htmlFor="benefit-name">Benefit name</label>
                  <input
                    id="benefit-name"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="e.g. Learning stipend"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="benefit-amount">Amount</label>
                    <input
                      id="benefit-amount"
                      type="number"
                      min={0}
                      value={form.amount}
                      onChange={(e) => setField("amount", e.target.value)}
                      placeholder="Enter amount"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="benefit-frequency">Frequency</label>
                    <select
                      id="benefit-frequency"
                      value={form.frequency}
                      onChange={(e) => setField("frequency", e.target.value as Benefit["frequency"])}
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="benefit-status">Status</label>
                    <select
                      id="benefit-status"
                      value={form.status}
                      onChange={(e) => setField("status", e.target.value as Benefit["status"])}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="benefit-effective">Effective Date</label>
                    <input
                      id="benefit-effective"
                      type="date"
                      value={form.effectiveDate}
                      onChange={(e) => setField("effectiveDate", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.taxable}
                      onChange={(e) => setField("taxable", e.target.checked)}
                    />
                    <span className="checkbox-text">Taxable benefit (included in PAYE)</span>
                  </label>
                </div>

                <div className="form-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => setForm(defaultForm)}>
                    Reset
                  </button>
                  <button className={`btn btn-primary${adding ? " btn-loading" : ""}`} disabled={adding} type="submit">
                    {adding && <span className="btn-spinner" />}
                    {adding ? "Adding..." : "Add benefit"}
                  </button>
                </div>
              </form>
            </article>
          )}

          {showReport && (
            <article className="panel panel-elevated benefit-table-panel">
              <div className="panel-header">
                <h2>Configured Perks</h2>
                <p>Review your active and paused benefits.</p>
              </div>

              {benefits.length === 0 ? (
                <div className="table-empty">
                  <BenefitEmptyIcon />
                  <p className="table-empty-title">No benefits configured</p>
                  <p className="table-empty-desc">Add your first benefit using the form.</p>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table benefit-table">
                    <thead>
                      <tr>
                        <th>Benefit</th>
                        <th>Amount</th>
                        <th>Frequency</th>
                        <th>Taxable</th>
                        <th>Status</th>
                        <th>Effective</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {benefits.map((benefit) => (
                        <tr key={benefit.id}>
                          <td>{benefit.name}</td>
                          <td>
                            {benefit.amount.toLocaleString(undefined, {
                              style: "currency",
                              currency: "KES",
                            })}
                          </td>
                          <td>{benefit.frequency}</td>
                          <td>{benefit.taxable ? "Yes" : "No"}</td>
                          <td>
                            <span className={`status-badge status-${benefit.status}`}>
                              {benefit.status}
                            </span>
                          </td>
                          <td>{benefit.effectiveDate || "-"}</td>
                          <td className="action-cell">
                            <button
                              aria-label="Benefit actions"
                              className="action-menu-btn"
                              onClick={() => setActiveMenu(activeMenu === benefit.id ? null : benefit.id)}
                              type="button"
                            >
                              <DotsIcon />
                            </button>
                            {activeMenu === benefit.id && (
                              <>
                                <button
                                  aria-label="Close menu"
                                  className="popover-backdrop"
                                  onClick={() => setActiveMenu(null)}
                                  type="button"
                                />
                                <div className="action-popover">
                                  <button
                                    className="action-popover-item danger"
                                    onClick={() => { removeBenefit(benefit.id); setActiveMenu(null); }}
                                    type="button"
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
                </div>
              )}
            </article>
          )}
        </div>
      </section>
    </main>
  );
}


function DotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="5" fill="currentColor" r="1.6" />
      <circle cx="12" cy="12" fill="currentColor" r="1.6" />
      <circle cx="12" cy="19" fill="currentColor" r="1.6" />
    </svg>
  );
}

function BenefitEmptyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <rect x="8" y="12" width="32" height="28" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 12v-2a8 8 0 0116 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="24" x2="30" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="30" x2="26" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
