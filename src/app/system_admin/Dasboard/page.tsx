"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

export default function SystemDashboardPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [stats, setStats] = useState({ tenants: 0, employees: 0, payroll: 0 });
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    if (current.role !== "system_admin") {
      router.replace("/pages/Dashboard");
      return;
    }

    setSession(current);
    void api
      .systemDashboard()
      .then(setStats)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load overview");
      });
  }, [router]);

  const avgEmployeesPerTenant = useMemo(() => {
    if (stats.tenants === 0) return 0;
    return Math.round(stats.employees / stats.tenants);
  }, [stats]);

  const payrollPerTenant = useMemo(() => {
    if (stats.tenants === 0) return 0;
    return Math.round(stats.payroll / stats.tenants);
  }, [stats]);

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide">
        <div className="page-header">
          <h1>System Admin Overview</h1>
          <p>Monitor tenants, payroll exposure, and platform health.</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="cards-grid four-col">
          <article className="card card-metric">
            <span className="metric-label">Total Tenants</span>
            <span className="metric-value">{stats.tenants}</span>
            <span className="metric-sublabel">Active organizations</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Total Employees</span>
            <span className="metric-value">{stats.employees}</span>
            <span className="metric-sublabel">Across all tenants</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Global Payroll</span>
            <span className="metric-value">${stats.payroll.toLocaleString()}</span>
            <span className="metric-sublabel">Monthly aggregate</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Employees per Tenant</span>
            <span className="metric-value">{avgEmployeesPerTenant}</span>
            <span className="metric-sublabel">Avg distribution</span>
          </article>
        </div>

        <div className="cards-grid two-col">
          <article className="panel panel-elevated">
            <div className="panel-header">
              <h2>Portfolio Insights</h2>
              <p>High-level indicators for tenant activity.</p>
            </div>
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-label">Payroll per Tenant</span>
                <strong>${payrollPerTenant.toLocaleString()}</strong>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Headcount</span>
                <strong>{avgEmployeesPerTenant}</strong>
              </div>
              <div className="stat-item">
                <span className="stat-label">System Coverage</span>
                <strong>{stats.tenants === 0 ? 0 : Math.min(100, Math.round((stats.employees / (stats.tenants * 150)) * 100))}%</strong>
              </div>
            </div>
          </article>

          <article className="panel panel-elevated">
            <div className="panel-header">
              <h2>Platform Health</h2>
              <p>Status checkpoints across the system.</p>
            </div>
            <ul className="simple-list">
              <li>
                <span>API availability</span>
                <span>Healthy</span>
                <span>99.98%</span>
                <span className="muted">Last 24h</span>
              </li>
              <li>
                <span>Payroll processing</span>
                <span>Operational</span>
                <span>1.3k</span>
                <span className="muted">Queued tasks</span>
              </li>
              <li>
                <span>Payment gateways</span>
                <span>Stable</span>
                <span>4/4</span>
                <span className="muted">Providers online</span>
              </li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
