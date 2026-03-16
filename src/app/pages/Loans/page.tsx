"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api, type Loan } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

type LoanRecord = Loan;

export default function LoansPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [loanEmployee, setLoanEmployee] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanOutstanding, setLoanOutstanding] = useState("");
  const [loanNextPayment, setLoanNextPayment] = useState("");
  const [loanPurpose, setLoanPurpose] = useState("");
  const [loanTenure, setLoanTenure] = useState("");
  const [loanRate, setLoanRate] = useState("");
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
    api.listLoans(current.orgId)
      .then((data) => setLoans(Array.isArray(data) ? data : []))
      .catch(() => setLoans([]));
  }, [router]);

  const settleLoan = async (id: string) => {
    if (!session?.orgId) return;
    const target = loans.find((loan) => loan.id === id);
    if (!target) return;
    try {
      const updated = await api.updateLoan({
        ...target,
        orgId: session.orgId,
        outstanding: 0,
        status: "settled",
        nextPayment: "",
      });
      setLoans((prev) => prev.map((loan) => (loan.id === id ? updated : loan)));
    } catch {
      // ignore for now
    }
  };

  const resetLoanForm = () => {
    setLoanEmployee("");
    setLoanAmount("");
    setLoanOutstanding("");
    setLoanNextPayment("");
    setLoanPurpose("");
    setLoanTenure("");
    setLoanRate("");
    setEditingLoanId(null);
  };

  const openNewLoanForm = () => {
    resetLoanForm();
    setShowForm(true);
  };

  const openEditLoanForm = (loan: LoanRecord) => {
    setEditingLoanId(loan.id);
    setLoanEmployee(loan.employee);
    setLoanAmount(String(loan.amount));
    setLoanOutstanding(String(loan.outstanding));
    setLoanNextPayment(loan.nextPayment === "-" ? "" : loan.nextPayment);
    setLoanPurpose(loan.purpose ?? "");
    setLoanTenure(loan.tenure ? String(loan.tenure) : "");
    setLoanRate(loan.rate ? String(loan.rate) : "");
    setShowForm(true);
  };

  const onAddLoan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session?.orgId) return;
    const amount = Number(loanAmount);
    if (!loanEmployee || !amount) {
      return;
    }

    const outstanding = loanOutstanding ? Number(loanOutstanding) : amount;
    const nextPayment = loanNextPayment || "TBD";
    const tenure = loanTenure ? Number(loanTenure) : undefined;
    const rate = loanRate ? Number(loanRate) : undefined;

    const editingStatus = editingLoanId ? loans.find((loan) => loan.id === editingLoanId)?.status : undefined;
    try {
      if (editingLoanId) {
        const updated = await api.updateLoan({
          id: editingLoanId,
          orgId: session.orgId,
          employee: loanEmployee,
          amount,
          outstanding,
          nextPayment,
          status: editingStatus || "open",
          purpose: loanPurpose || undefined,
          tenure,
          rate,
        });
        setLoans((prev) => prev.map((loan) => (loan.id === updated.id ? updated : loan)));
      } else {
        const created = await api.createLoan({
          orgId: session.orgId,
          employee: loanEmployee,
          amount,
          outstanding,
          nextPayment,
          status: "open",
          purpose: loanPurpose || undefined,
          tenure,
          rate,
        });
        setLoans((prev) => [created, ...prev]);
      }
      resetLoanForm();
      setShowForm(false);
    } catch {
      // ignore for now
    }
  };

  const removeLoan = async (id: string) => {
    if (!session?.orgId) return;
    try {
      await api.deleteLoan(session.orgId, id);
      setLoans((prev) => prev.filter((loan) => loan.id !== id));
    } catch {
      // ignore for now
    }
  };

  const globeSummary = useMemo(
    () => ({
      total: loans.reduce((acc, loan) => acc + loan.amount, 0),
      remaining: loans.reduce((acc, loan) => acc + loan.outstanding, 0),
      active: loans.filter((loan) => loan.status === "open").length,
    }),
    [loans]
  );

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide">
        <div className="page-header-row">
          <div className="page-header">
            <h1>Employee Loans</h1>
            <p>Track employer-assisted loans alongside payroll runs.</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-primary btn-sm" type="button" onClick={openNewLoanForm}>
              Add Loan
            </button>
          </div>
        </div>

        <div className="cards-grid three-col">
          <article className="card card-metric">
            <span className="metric-label">Total Loaned</span>
            <span className="metric-value">${globeSummary.total.toLocaleString()}</span>
            <span className="metric-sublabel">Lifetime issued</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Outstanding</span>
            <span className="metric-value">${globeSummary.remaining.toLocaleString()}</span>
            <span className="metric-sublabel">Remaining balance</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Active Plans</span>
            <span className="metric-value">{globeSummary.active}</span>
            <span className="metric-sublabel">Open schedules</span>
          </article>
        </div>

        <article className="panel panel-elevated">
          <div className="panel-header">
            <h2>Active Loan Schedules</h2>
            <p>Track repayment timelines and balances.</p>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Amount</th>
                  <th>Outstanding</th>
                  <th>Next payment</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.employee}</td>
                    <td>${loan.amount.toLocaleString()}</td>
                    <td>${loan.outstanding.toLocaleString()}</td>
                    <td>{loan.nextPayment || "-"}</td>
                    <td>
                      <span className={`status-badge status-${loan.status}`}>{loan.status}</span>
                    </td>
                    <td>
                      <div className="inline-actions">
                        {loan.status !== "settled" && (
                          <button className="secondary" onClick={() => settleLoan(loan.id)} type="button">
                            Settle
                          </button>
                        )}
                        <button className="neutral" onClick={() => openEditLoanForm(loan)} type="button">
                          Edit
                        </button>
                        <button className="danger" onClick={() => removeLoan(loan.id)} type="button">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {showForm && (
          <div className="modal-backdrop" onClick={() => { setShowForm(false); resetLoanForm(); }}>
            <div className="modal-content modal-large" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingLoanId ? "Edit Loan" : "New Loan"}</h3>
                <button className="modal-close" onClick={() => { setShowForm(false); resetLoanForm(); }} type="button">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <form className="form-grid form-two-col" onSubmit={onAddLoan}>
                  <div className="form-group">
                    <label htmlFor="loanEmployee">Employee</label>
                    <input
                      id="loanEmployee"
                      value={loanEmployee}
                      onChange={(event) => setLoanEmployee(event.target.value)}
                      placeholder="Employee name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="loanAmount">Loan Amount</label>
                    <input
                      id="loanAmount"
                      type="number"
                      min={0}
                      value={loanAmount}
                      onChange={(event) => setLoanAmount(event.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="loanPurpose">Purpose</label>
                    <input
                      id="loanPurpose"
                      value={loanPurpose}
                      onChange={(event) => setLoanPurpose(event.target.value)}
                      placeholder="e.g., Education, Medical"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="loanTenure">Tenure (months)</label>
                    <input
                      id="loanTenure"
                      type="number"
                      min={1}
                      value={loanTenure}
                      onChange={(event) => setLoanTenure(event.target.value)}
                      placeholder="12"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="loanOutstanding">Outstanding</label>
                    <input
                      id="loanOutstanding"
                      type="number"
                      min={0}
                      value={loanOutstanding}
                      onChange={(event) => setLoanOutstanding(event.target.value)}
                      placeholder="Defaults to amount"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="loanNextPayment">Next Payment</label>
                    <input
                      id="loanNextPayment"
                      type="date"
                      value={loanNextPayment}
                      onChange={(event) => setLoanNextPayment(event.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="loanRate">Interest Rate (%)</label>
                    <input
                      id="loanRate"
                      type="number"
                      min={0}
                      value={loanRate}
                      onChange={(event) => setLoanRate(event.target.value)}
                      placeholder="8"
                    />
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => { setShowForm(false); resetLoanForm(); }}>
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
