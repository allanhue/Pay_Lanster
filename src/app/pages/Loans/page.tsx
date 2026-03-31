"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import ModuleActions from "@/app/components/ModuleActions";
import { api, type Loan, type PayrollEmployee } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

const defaultForm = {
  employee: "",
  amount: "",
  outstanding: "",
  nextPayment: "",
  purpose: "",
  tenure: "",
  rate: "",
};

export default function LoansPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    const current = readSession();
    if (!current) { router.replace("/auth/login"); return; }
    if (current.role !== "org_admin") { router.replace("/system_admin/Dashboard"); return; }
    setSession(current);
    if (current.orgId) {
      api.listLoans(current.orgId)
        .then((data) => setLoans(Array.isArray(data) ? data : []))
        .catch(() => setLoans([]));
      api.listEmployees(current.orgId)
        .then((data) => setEmployees(Array.isArray(data) ? data : []))
        .catch(() => setEmployees([]));
    }
  }, [router]);

  const setField = <K extends keyof typeof defaultForm>(key: K, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const employeeSuggestions = useMemo(() => {
    const query = form.employee.trim().toLowerCase();
    const matches = employees.filter((e) => e.fullName.toLowerCase().includes(query));
    return (query ? matches : employees).slice(0, 8);
  }, [employees, form.employee]);

  const summary = useMemo(() => ({
    total: loans.reduce((acc, l) => acc + l.amount, 0),
    remaining: loans.reduce((acc, l) => acc + l.outstanding, 0),
    active: loans.filter((l) => l.status === "open").length,
  }), [loans]);

  const resetForm = () => { setForm(defaultForm); setEditingLoanId(null); };

  const closeModal = () => { setShowForm(false); resetForm(); };

  const openNewLoanForm = () => { resetForm(); setShowForm(true); };

  const openEditLoanForm = (loan: Loan) => {
    setEditingLoanId(loan.id);
    setForm({
      employee: loan.employee,
      amount: String(loan.amount),
      outstanding: String(loan.outstanding),
      nextPayment: loan.nextPayment === "-" ? "" : loan.nextPayment,
      purpose: loan.purpose ?? "",
      tenure: loan.tenure ? String(loan.tenure) : "",
      rate: loan.rate ? String(loan.rate) : "",
    });
    setShowForm(true);
  };

  const settleLoan = async (id: string) => {
    if (!session?.orgId) return;
    const target = loans.find((l) => l.id === id);
    if (!target) return;
    try {
      const updated = await api.updateLoan({ ...target, orgId: session.orgId, outstanding: 0, status: "settled", nextPayment: "" });
      setLoans((prev) => prev.map((l) => (l.id === id ? updated : l)));
    } catch { /* ignore */ }
  };

  const removeLoan = async (id: string) => {
    if (!session?.orgId) return;
    try {
      await api.deleteLoan(session.orgId, id);
      setLoans((prev) => prev.filter((l) => l.id !== id));
    } catch { /* ignore */ }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.orgId || !form.employee || !form.amount) return;
    const amount = Number(form.amount);
    const outstanding = form.outstanding ? Number(form.outstanding) : amount;
    const nextPayment = form.nextPayment || "TBD";
    const tenure = form.tenure ? Number(form.tenure) : undefined;
    const rate = form.rate ? Number(form.rate) : undefined;
    const editingStatus = editingLoanId ? loans.find((l) => l.id === editingLoanId)?.status : undefined;
    try {
      if (editingLoanId) {
        const updated = await api.updateLoan({ id: editingLoanId, orgId: session.orgId, employee: form.employee, amount, outstanding, nextPayment, status: editingStatus || "open", purpose: form.purpose || undefined, tenure, rate });
        setLoans((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      } else {
        const created = await api.createLoan({ orgId: session.orgId, employee: form.employee, amount, outstanding, nextPayment, status: "open", purpose: form.purpose || undefined, tenure, rate });
        setLoans((prev) => [created, ...prev]);
      }
      closeModal();
    } catch { /* ignore */ }
  };

  if (!session) return <main className="centered">Loading…</main>;

  return (
    <main className="page-shell">
      <Navbar session={session} />

      <section className="content content-wide">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-content">
            <h1>Employee Loans</h1>
            <p>Track employer-assisted loans alongside payroll runs.</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-primary btn-sm" onClick={openNewLoanForm} type="button">
              Add Loan
            </button>
            <ModuleActions />
          </div>
        </div>

        {/* Summary metrics */}
        <div className="cards-grid three-col">
          <article className="card card-metric">
            <span className="metric-label">Total Loaned</span>
            <span className="metric-value">KES {summary.total.toLocaleString()}</span>
            <span className="metric-sublabel">Lifetime issued</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Outstanding</span>
            <span className="metric-value">KES {summary.remaining.toLocaleString()}</span>
            <span className="metric-sublabel">Remaining balance</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Active Plans</span>
            <span className="metric-value">{summary.active}</span>
            <span className="metric-sublabel">Open schedules</span>
          </article>
        </div>

        {/* Loans table */}
        <article className="panel panel-elevated">
          <div className="panel-header">
            <h2>Active Loan Schedules</h2>
            <p>Track repayment timelines and balances.</p>
          </div>

          {loans.length === 0 ? (
            <div className="table-empty">
              <LoanEmptyIcon />
              <p className="table-empty-title">No loans recorded</p>
              <p className="table-empty-desc">Add your first employee loan to get started.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Amount</th>
                    <th>Outstanding</th>
                    <th>Next Payment</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => (
                    <tr key={loan.id}>
                      <td>{loan.employee}</td>
                      <td>KES {loan.amount.toLocaleString()}</td>
                      <td>KES {loan.outstanding.toLocaleString()}</td>
                      <td>{loan.nextPayment || "—"}</td>
                      <td>
                        <span className={`status-badge status-${loan.status}`}>{loan.status}</span>
                      </td>
                      <td className="action-cell">
                        <button
                          aria-label="Loan actions"
                          className="action-menu-btn"
                          onClick={() => setSelectedLoan(selectedLoan?.id === loan.id ? null : loan)}
                          type="button"
                        >
                          <DotsIcon />
                        </button>
                        {selectedLoan?.id === loan.id && (
                          <>
                            <button
                              aria-label="Close menu"
                              className="popover-backdrop"
                              onClick={() => setSelectedLoan(null)}
                              type="button"
                            />
                            <div className="action-popover">
                              {loan.status !== "settled" && (
                                <button
                                  className="action-popover-item"
                                  onClick={() => { settleLoan(loan.id); setSelectedLoan(null); }}
                                  type="button"
                                >
                                  Settle
                                </button>
                              )}
                              <button
                                className="action-popover-item"
                                onClick={() => { openEditLoanForm(loan); setSelectedLoan(null); }}
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                className="action-popover-item danger"
                                onClick={() => { removeLoan(loan.id); setSelectedLoan(null); }}
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

        {/* Modal */}
        {showForm && (
          <div className="modal-backdrop" onClick={closeModal}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>

              <div className="modal-header">
                <h3>{editingLoanId ? "Edit Loan" : "New Loan"}</h3>
                <button aria-label="Close modal" className="modal-close" onClick={closeModal} type="button">
                  <CloseIcon />
                </button>
              </div>

              <div className="modal-body">
                <form className="modal-form" onSubmit={onSubmit}>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="loanEmployee">Employee</label>
                      <input
                        id="loanEmployee"
                        list="loanEmployeeList"
                        onChange={(e) => setField("employee", e.target.value)}
                        placeholder="Employee name"
                        required
                        value={form.employee}
                      />
                      <datalist id="loanEmployeeList">
                        {employeeSuggestions.map((e) => (
                          <option key={e.id} value={e.fullName} />
                        ))}
                      </datalist>
                    </div>
                    <div className="form-group">
                      <label htmlFor="loanAmount">Loan Amount</label>
                      <input
                        id="loanAmount"
                        min={0}
                        onChange={(e) => setField("amount", e.target.value)}
                        placeholder="0.00"
                        required
                        type="number"
                        value={form.amount}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="loanPurpose">Purpose</label>
                      <input
                        id="loanPurpose"
                        onChange={(e) => setField("purpose", e.target.value)}
                        placeholder="e.g. Education, Medical"
                        value={form.purpose}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="loanTenure">Tenure (months)</label>
                      <input
                        id="loanTenure"
                        min={1}
                        onChange={(e) => setField("tenure", e.target.value)}
                        placeholder="12"
                        type="number"
                        value={form.tenure}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="loanOutstanding">Outstanding</label>
                      <input
                        id="loanOutstanding"
                        min={0}
                        onChange={(e) => setField("outstanding", e.target.value)}
                        placeholder="Defaults to amount"
                        type="number"
                        value={form.outstanding}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="loanNextPayment">Next Payment</label>
                      <input
                        id="loanNextPayment"
                        onChange={(e) => setField("nextPayment", e.target.value)}
                        type="date"
                        value={form.nextPayment}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="loanRate">Interest Rate (%)</label>
                      <input
                        id="loanRate"
                        min={0}
                        onChange={(e) => setField("rate", e.target.value)}
                        placeholder="8"
                        type="number"
                        value={form.rate}
                      />
                    </div>
                    {/* spacer to keep grid aligned */}
                    <div className="form-group" aria-hidden="true" />
                  </div>

                  <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={closeModal} type="button">
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit">
                      {editingLoanId ? "Save Changes" : "Create Loan"}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="5" fill="currentColor" r="1.6" />
      <circle cx="12" cy="12" fill="currentColor" r="1.6" />
      <circle cx="12" cy="19" fill="currentColor" r="1.6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function LoanEmptyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <rect fill="none" height="30" rx="3" stroke="currentColor" strokeWidth="1.5" width="34" x="7" y="10" />
      <path d="M15 24h8M15 30h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <circle cx="33" cy="33" fill="none" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M33 29v4l2.5 2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}