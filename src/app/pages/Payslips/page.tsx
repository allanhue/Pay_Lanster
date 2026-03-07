"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

type Payslip = {
  id: string;
  employee: string;
  period: string;
  gross: number;
  deductions: number;
  net: number;
  approval: "pending" | "approved" | "rejected";
};

const initialPayslips: Payslip[] = [
  { id: "PS-1201", employee: "Jane Adams", period: "Apr 2026", gross: 5200, deductions: 980, net: 4220, approval: "pending" },
  { id: "PS-1202", employee: "Mark Ellis", period: "Apr 2026", gross: 6100, deductions: 1245, net: 4855, approval: "approved" },
  { id: "PS-1203", employee: "Lena Ortiz", period: "Apr 2026", gross: 4700, deductions: 920, net: 3780, approval: "pending" },
];

export default function PayslipsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>(initialPayslips);
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

  const setStatus = (id: string, approval: Payslip["approval"]) => {
    setPayslips((prev) => prev.map((item) => (item.id === id ? { ...item, approval } : item)));
  };

  if (!session) return <main className="centered">Loading...</main>;

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <h1>Payslips</h1>
        <p>Review and approve generated payslips before release.</p>
        <article className="panel">
          <table className="loan-table">
            <thead>
              <tr>
                <th>Slip ID</th>
                <th>Employee</th>
                <th>Period</th>
                <th>Gross</th>
                <th>Deductions</th>
                <th>Net</th>
                <th>Approval</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.employee}</td>
                  <td>{item.period}</td>
                  <td>${item.gross.toLocaleString()}</td>
                  <td>${item.deductions.toLocaleString()}</td>
                  <td>${item.net.toLocaleString()}</td>
                  <td>
                    <span className={`loan-chip loan-${item.approval}`}>{item.approval}</span>
                  </td>
                  <td>
                    <div className="inline-actions">
                      <button className="secondary" type="button" onClick={() => setStatus(item.id, "approved")}>
                        Approve
                      </button>
                      <button className="danger" type="button" onClick={() => setStatus(item.id, "rejected")}>
                        Reject
                      </button>
                    </div>
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
