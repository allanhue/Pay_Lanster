"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

type PayrunRow = {
  id: string;
  period: string;
  payday: string;
  netPayroll: number;
  employees: number;
  status: "draft" | "approved" | "completed";
};

const samplePayruns: PayrunRow[] = [
  { id: "PR-0426", period: "April 2026", payday: "Apr 30", netPayroll: 184200, employees: 82, status: "approved" },
  { id: "PR-0326", period: "March 2026", payday: "Mar 31", netPayroll: 178900, employees: 79, status: "completed" },
  { id: "PR-0226", period: "February 2026", payday: "Feb 26", netPayroll: 172500, employees: 75, status: "draft" },
];

export default function PayrunPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const router = useRouter();
  const [payruns, setPayruns] = useState<PayrunRow[]>(samplePayruns);

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

  const totals = useMemo(
    () => ({
      totalPayroll: payruns.reduce((acc, row) => acc + row.netPayroll, 0),
      upcoming: payruns.find((row) => row.status === "draft"),
    }),
    [payruns]
  );

  const hero = totals.upcoming ?? payruns[0];

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <h1>Payrun Center</h1>
        <p>Preview payroll batches, queue releases, and inspect run details.</p>

        <article className="panel">
          <h2>Next release</h2>
          <div className="cards-grid">
            <div className="card">
              <p className="muted">Period</p>
              <strong>{hero.period}</strong>
            </div>
            <div className="card">
              <p className="muted">Pay Date</p>
              <strong>{hero.payday}</strong>
            </div>
            <div className="card">
              <p className="muted">Net Payroll</p>
              <strong>${hero.netPayroll.toLocaleString()}</strong>
            </div>
            <div className="card">
              <p className="muted">Employees</p>
              <strong>{hero.employees}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <h2>Payrun history</h2>
          <table className="loan-table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Payday</th>
                <th>Net</th>
                <th>Employees</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payruns.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.payday}</td>
                  <td>${row.netPayroll.toLocaleString()}</td>
                  <td>{row.employees}</td>
                  <td>
                    <span className={`loan-chip loan-${row.status}`}>
                      {row.status}
                    </span>
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
