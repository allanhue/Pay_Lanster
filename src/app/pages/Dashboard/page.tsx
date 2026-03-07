"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api, type DashboardStats, type PayrollEmployee } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

export default function DashboardPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    if (current.role !== "org_admin" || !current.orgId) {
      router.replace("/system_admin/Dasboard");
      return;
    }

    const orgId = current.orgId;
    if (!orgId) {
      router.replace("/auth/login");
      return;
    }

    setSession(current);
    void (async () => {
      try {
        const [dashboard, list] = await Promise.all([api.orgDashboard(orgId), api.listEmployees(orgId)]);
        setStats(dashboard);
        setEmployees(list.slice(0, 5));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load dashboard");
      }
    })();
  }, [router]);

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <h1>Organization Payroll Dashboard</h1>
        <p>Track payroll KPIs for {session.orgName}.</p>

        {error && <div className="error-text">{error}</div>}

        <div className="cards-grid">
          <article className="card">
            <h3>Total Employees</h3>
            <strong>{stats?.totalEmployees ?? 0}</strong>
          </article>
          <article className="card">
            <h3>Active Employees</h3>
            <strong>{stats?.activeEmployees ?? 0}</strong>
          </article>
          <article className="card">
            <h3>Monthly Payroll</h3>
            <strong>${(stats?.monthlyPayroll ?? 0).toLocaleString()}</strong>
          </article>
          <article className="card">
            <h3>Average Salary</h3>
            <strong>${(stats?.avgSalary ?? 0).toLocaleString()}</strong>
          </article>
        </div>

        <article className="panel">
          <h2>Recent Employees</h2>
          {employees.length === 0 ? (
            <p>No employees yet. Add them in the Employees page.</p>
          ) : (
            <ul className="simple-list">
              {employees.map((employee) => (
                <li key={employee.id}>
                  <span>{employee.fullName}</span>
                  <span>{employee.department}</span>
                  <span>${employee.salary.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}
