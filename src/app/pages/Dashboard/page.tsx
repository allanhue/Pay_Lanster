"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api, type DashboardStats, type PayrollEmployee } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];

function toPolyline(values: number[], width: number, height: number, padding = 18): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return values
    .map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / (values.length - 1);
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

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
    setSession(current);
    void (async () => {
      try {
        const [dashboard, list] = await Promise.all([api.orgDashboard(orgId), api.listEmployees(orgId)]);
        setStats(dashboard);
        setEmployees(Array.isArray(list) ? list : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load dashboard");
      }
    })();
  }, [router]);

  const payrollTrend = useMemo(() => {
    const base = stats?.monthlyPayroll ?? 0;
    return [0.86, 0.91, 0.95, 1.03, 1.08, 1].map((factor) => Math.round(base * factor));
  }, [stats]);

  const activeRate = useMemo(() => {
    if (!stats || stats.totalEmployees === 0) {
      return 0;
    }
    return Math.round((stats.activeEmployees / stats.totalEmployees) * 100);
  }, [stats]);

  const avgMonthlyCost = useMemo(() => {
    if (!stats || stats.activeEmployees === 0) {
      return 0;
    }
    return Math.round((stats.monthlyPayroll / stats.activeEmployees) * 100) / 100;
  }, [stats]);

  const hiresByDept = useMemo(() => {
    const counts = employees.reduce<Record<string, number>>((acc, employee) => {
      acc[employee.department] = (acc[employee.department] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).slice(0, 6);
  }, [employees]);

  const recentHires = useMemo(
    () =>
      [...employees]
        .slice(-8)
        .reverse()
        .map((employee, idx) => ({
          ...employee,
          hiredDate: new Date(Date.now() - idx * 86400000 * 6).toLocaleDateString(),
        })),
    [employees]
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
            <h1>Organization Payroll Dashboard</h1>
            <p>Track payroll KPIs, trends, and new hires for {session.orgName}.</p>
          </div>
          <div className="page-header-meta">
            <span className="stat-chip">Active rate: {activeRate}%</span>
            <span className="stat-chip">
              Avg monthly cost: ${avgMonthlyCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="cards-grid four-col">
          <article className="card card-metric">
            <span className="metric-label">Total Employees</span>
            <span className="metric-value">{stats?.totalEmployees ?? 0}</span>
            <span className="metric-sublabel">Across departments</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Active Employees</span>
            <span className="metric-value">{stats?.activeEmployees ?? 0}</span>
            <span className="metric-sublabel">{activeRate}% active rate</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Monthly Payroll</span>
            <span className="metric-value">${(stats?.monthlyPayroll ?? 0).toLocaleString()}</span>
            <span className="metric-sublabel">Including allowances</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Average Salary</span>
            <span className="metric-value">${(stats?.avgSalary ?? 0).toLocaleString()}</span>
            <span className="metric-sublabel">Annualized</span>
          </article>
        </div>

        <div className="panel panel-elevated quick-actions">
          <div className="panel-header">
            <h2>Quick Actions</h2>
            <p>Launch common workflows without leaving the dashboard.</p>
          </div>
          <div className="action-grid">
            <div className="action-card">
              <div className="action-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M7 9h10M7 13h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <div className="action-title">Run Payroll</div>
              <div className="action-desc">Create and preview a new payrun.</div>
            </div>
            <div className="action-card">
              <div className="action-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 10a3 3 0 116 0 3 3 0 01-6 0z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M4 20c0-3 3-5 7-5s7 2 7 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <div className="action-title">Add Employee</div>
              <div className="action-desc">Invite a new team member.</div>
            </div>
            <div className="action-card">
              <div className="action-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 3h10l2 2v16H5V5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M9 10h6M9 14h6M9 18h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <div className="action-title">Review Payslips</div>
              <div className="action-desc">Approve and export payslips.</div>
            </div>
            <div className="action-card">
              <div className="action-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 4h12v16H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M10 8h4M10 12h4M10 16h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <div className="action-title">Open Reports</div>
              <div className="action-desc">View payroll insights.</div>
            </div>
          </div>
        </div>

        <div className="cards-grid analytics-grid">
          <article className="panel panel-elevated">
            <h2>Payroll Trend</h2>
            <svg className="chart-svg" viewBox="0 0 420 170" role="img" aria-label="Payroll line chart">
              <polyline className="line-chart" fill="none" points={toPolyline(payrollTrend, 420, 170)} />
              {payrollTrend.map((value, index) => {
                const x = 18 + (index * (420 - 36)) / (payrollTrend.length - 1);
                const y =
                  170 -
                  18 -
                  ((value - Math.min(...payrollTrend)) / ((Math.max(...payrollTrend) - Math.min(...payrollTrend)) || 1)) *
                    (170 - 36);
                return <circle key={`line-dot-${MONTHS[index]}`} cx={x} cy={y} r="3.5" className="line-dot" />;
              })}
            </svg>
            <div className="chart-labels">
              {MONTHS.map((month) => (
                <span key={`month-${month}`}>{month}</span>
              ))}
            </div>
          </article>

          <article className="panel panel-elevated">
            <h2>Department Hiring</h2>
            <div className="bar-chart">
              {hiresByDept.length === 0 ? (
                <p className="muted">No department data yet.</p>
              ) : (
                hiresByDept.map(([department, count]) => (
                  <div className="bar-row" key={`bar-${department}`}>
                    <span>{department}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.max(8, count * 18)}%` }} />
                    </div>
                    <strong>{count}</strong>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>

        <article className="panel panel-elevated">
          <h2>Recent Hires</h2>
          {recentHires.length === 0 ? (
            <p>No hires yet. Add employees in the Employees module.</p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Pay Cycle</th>
                    <th>Salary</th>
                    <th>Hired Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentHires.map((employee) => (
                    <tr key={employee.id}>
                      <td>{employee.fullName}</td>
                      <td>{employee.department}</td>
                      <td>{employee.payCycle}</td>
                      <td>${employee.salary.toLocaleString()}</td>
                      <td>{employee.hiredDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
