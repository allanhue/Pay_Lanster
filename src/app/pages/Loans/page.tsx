"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

type LoanRecord = {
  id: string;
  employee: string;
  amount: number;
  outstanding: number;
  nextPayment: string;
  status: "open" | "paused" | "settled";
};

const initialLoans: LoanRecord[] = [
  { id: "LN-2034", employee: "Jane Adams", amount: 5400, outstanding: 1600, nextPayment: "Apr 28", status: "open" },
  { id: "LN-2035", employee: "Mark Ellis", amount: 12000, outstanding: 4000, nextPayment: "May 05", status: "paused" },
  { id: "LN-2036", employee: "Lena Ortiz", amount: 3200, outstanding: 0, nextPayment: "-", status: "settled" },
];

export default function LoansPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loans, setLoans] = useState<LoanRecord[]>(initialLoans);
  const [showForm, setShowForm] = useState(false);
  const [loanEmployee, setLoanEmployee] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanOutstanding, setLoanOutstanding] = useState("");
  const [loanNextPayment, setLoanNextPayment] = useState("");
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

  const settleLoan = (id: string) => {
    setLoans((prev) =>
      prev.map((loan) =>
        loan.id === id
          ? {
              ...loan,
              outstanding: 0,
              status: "settled",
              nextPayment: "-",
            }
          : loan
      )
    );
  };

  const onAddLoan = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(loanAmount);
    if (!loanEmployee || !amount) {
      return;
    }

    const outstanding = loanOutstanding ? Number(loanOutstanding) : amount;
    const nextPayment = loanNextPayment || "TBD";

    setLoans((prev) => [
      {
        id: `LN-${Date.now().toString().slice(-4)}`,
        employee: loanEmployee,
        amount,
        outstanding,
        nextPayment,
        status: "open",
      },
      ...prev,
    ]);

    setLoanEmployee("");
    setLoanAmount("");
    setLoanOutstanding("");
    setLoanNextPayment("");
    setShowForm(false);
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
            <button className="btn btn-primary btn-sm" type="button" onClick={() => setShowForm(true)}>
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
                    <td>{loan.nextPayment}</td>
                    <td>
                      <span className={`status-badge status-${loan.status}`}>{loan.status}</span>
                    </td>
                    <td>
                      {loan.status !== "settled" && (
                        <button className="secondary" onClick={() => settleLoan(loan.id)} type="button">
                          Settle
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {showForm && (
          <div className="modal-backdrop" onClick={() => setShowForm(false)}>
            <div className="modal-content modal-large" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>New Loan</h3>
                <button className="modal-close" onClick={() => setShowForm(false)} type="button">
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
                      value={loanNextPayment}
                      onChange={(event) => setLoanNextPayment(event.target.value)}
                      placeholder="Apr 30"
                    />
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit">
                      Create Loan
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
