"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

type Approval = {
  id: string;
  type: "payrun" | "payslip" | "benefit";
  reference: string;
  owner: string;
  requestedOn: string;
  status: "pending" | "approved" | "rejected";
};

const baseApprovals: Approval[] = [
  { id: "AP-301", type: "payrun", reference: "PR-0426", owner: "PayrollOps", requestedOn: "Apr 25", status: "pending" },
  { id: "AP-302", type: "payslip", reference: "PS-1201", owner: "Jane Adams", requestedOn: "Apr 26", status: "pending" },
  { id: "AP-303", type: "benefit", reference: "Transport uplift", owner: "HR", requestedOn: "Apr 26", status: "approved" },
];

export default function ApprovalsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>(baseApprovals);
  const router = useRouter();

  const setStatus = (id: string, status: Approval["status"]) => {
    setApprovals((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  };

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

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <h1>Approval queue</h1>
        <p>Approve payruns and payslips before payroll release.</p>
        <article className="panel">
          <table className="loan-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Owner</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((approval) => (
                <tr key={approval.id}>
                  <td>{approval.id}</td>
                  <td>{approval.type}</td>
                  <td>{approval.reference}</td>
                  <td>{approval.owner}</td>
                  <td>{approval.requestedOn}</td>
                  <td>
                    <span className={`loan-chip loan-${approval.status}`}>{approval.status}</span>
                  </td>
                  <td>
                    <div className="inline-actions">
                      <button className="secondary" onClick={() => setStatus(approval.id, "approved")} type="button">
                        Approve
                      </button>
                      <button className="danger" onClick={() => setStatus(approval.id, "rejected")} type="button">
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
