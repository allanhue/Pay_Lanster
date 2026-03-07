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
      <section className="content">
        <h1>Employee Loans</h1>
        <p>Track employer-assisted loans alongside payroll runs.</p>

        <div className="cards-grid">
          <article className="card">
            <h3>Total Loaned</h3>
            <strong>${globeSummary.total.toLocaleString()}</strong>
          </article>
          <article className="card">
            <h3>Outstanding</h3>
            <strong>${globeSummary.remaining.toLocaleString()}</strong>
          </article>
          <article className="card">
            <h3>Active Plans</h3>
            <strong>{globeSummary.active}</strong>
          </article>
        </div>

        <article className="panel">
          <h2>Active loan schedules</h2>
          <table className="loan-table">
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
                    <span className={`loan-chip loan-${loan.status}`}>{loan.status}</span>
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
        </article>
      </section>
    </main>
  );
}
