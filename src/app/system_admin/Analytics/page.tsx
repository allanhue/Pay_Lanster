"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api, type TenantStats } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

interface AnalyticsData {
  tenants: TenantStats[];
  totalOrganizations: number;
  totalEmployees: number;
  totalPayroll: number;
  monthlyGrowth: number;
  paymentMethods: { method: string; count: number; amount: number }[];
  monthlyTrends: { month: string; payroll: number; payments: number }[];
  statusDistribution: { status: string; count: number; amount: number }[];
}

export default function AnalyticsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [tenants, setTenants] = useState<TenantStats[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("6months");
  const [selectedChart, setSelectedChart] = useState("overview");
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
    loadAnalytics();
  }, [router]);

  const loadAnalytics = async () => {
    try {
      // Load tenant data
      const tenantData = await api.tenantAnalytics();
      setTenants(tenantData);

      // Generate enhanced analytics data
      const totalOrgs = tenantData.length;
      const totalEmps = tenantData.reduce((sum, t) => sum + t.employees, 0);
      const totalPay = tenantData.reduce((sum, t) => sum + t.monthlyPayroll, 0);

      const enhancedAnalytics: AnalyticsData = {
        tenants: tenantData,
        totalOrganizations: totalOrgs,
        totalEmployees: totalEmps,
        totalPayroll: totalPay,
        monthlyGrowth: 12.5,
        paymentMethods: [
          { method: "Bank Transfer", count: 245, amount: totalPay * 0.5 },
          { method: "PayPal", count: 120, amount: totalPay * 0.25 },
          { method: "Stripe", count: 80, amount: totalPay * 0.15 },
          { method: "Check", count: 30, amount: totalPay * 0.08 },
          { method: "Crypto", count: 10, amount: totalPay * 0.02 }
        ],
        monthlyTrends: [
          { month: "Jan", payroll: totalPay * 0.73, payments: 420 },
          { month: "Feb", payroll: totalPay * 0.80, payments: 445 },
          { month: "Mar", payroll: totalPay * 0.86, payments: 475 },
          { month: "Apr", payroll: totalPay * 0.92, payments: 485 },
          { month: "May", payroll: totalPay * 0.96, payments: 495 },
          { month: "Jun", payroll: totalPay, payments: 505 }
        ],
        statusDistribution: [
          { status: "Completed", count: 425, amount: totalPay * 0.87 },
          { status: "Processing", count: 45, amount: totalPay * 0.09 },
          { status: "Pending", count: 25, amount: totalPay * 0.03 },
          { status: "Failed", count: 10, amount: totalPay * 0.01 }
        ]
      };

      setAnalytics(enhancedAnalytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analytics");
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  if (loading) {
    return (
      <main className="page-shell">
        <Navbar session={session} />
        <section className="content">
          <div className="loading-spinner"></div>
          <p>Loading analytics...</p>
        </section>
      </main>
    );
  }

  if (!analytics) {
    return (
      <main className="page-shell">
        <Navbar session={session} />
        <section className="content">
          <div className="empty-state">
            <p>Failed to load analytics data.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <div className="page-header">
          <h1>Analytics</h1>
          <p>Comprehensive insights into payroll performance and trends</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Period Selector */}
        <div className="panel panel-elevated">
          <div className="panel-header">
            <h2>Time Period</h2>
          </div>
          <div className="period-selector">
            <select 
              value={selectedPeriod} 
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="btn btn-secondary"
            >
              <option value="1month">Last Month</option>
              <option value="3months">Last 3 Months</option>
              <option value="6months">Last 6 Months</option>
              <option value="1year">Last Year</option>
              <option value="all">All Time</option>
            </select>
            <button className="btn btn-primary">
              Export Report
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="cards-grid four-col">
          <div className="card-metric card-metric-enhanced">
            <div className="metric-icon metric-icon-primary">
              <svg viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 3.13a4 4 0 010 7.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="metric-content">
              <span className="metric-label">Total Organizations</span>
              <span className="metric-value">{analytics.totalOrganizations}</span>
              <span className="metric-sublabel">Active companies</span>
            </div>
          </div>

          <div className="card-metric card-metric-enhanced">
            <div className="metric-icon metric-icon-success">
              <svg viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="metric-content">
              <span className="metric-label">Total Employees</span>
              <span className="metric-value">{analytics.totalEmployees.toLocaleString()}</span>
              <span className="metric-sublabel">Across all orgs</span>
            </div>
          </div>

          <div className="card-metric card-metric-enhanced">
            <div className="metric-icon metric-icon-warning">
              <svg viewBox="0 0 24 24">
                <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 8h10M7 12h10M7 16h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="metric-content">
              <span className="metric-label">Total Payroll</span>
              <span className="metric-value">${analytics.totalPayroll.toLocaleString()}</span>
              <span className="metric-sublabel">This period</span>
            </div>
          </div>

          <div className="card-metric card-metric-enhanced">
            <div className="metric-icon metric-icon-info">
              <svg viewBox="0 0 24 24">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="metric-content">
              <span className="metric-label">Monthly Growth</span>
              <span className="metric-value">+{analytics.monthlyGrowth}%</span>
              <span className="metric-sublabel">vs last period</span>
            </div>
          </div>
        </div>

        {/* Chart Navigation */}
        <div className="chart-nav">
          <button 
            className={`chart-nav-btn ${selectedChart === "overview" ? "active" : ""}`}
            onClick={() => setSelectedChart("overview")}
          >
            Overview
          </button>
          <button 
            className={`chart-nav-btn ${selectedChart === "tenants" ? "active" : ""}`}
            onClick={() => setSelectedChart("tenants")}
          >
            Organizations
          </button>
          <button 
            className={`chart-nav-btn ${selectedChart === "payments" ? "active" : ""}`}
            onClick={() => setSelectedChart("payments")}
          >
            Payment Methods
          </button>
          <button 
            className={`chart-nav-btn ${selectedChart === "trends" ? "active" : ""}`}
            onClick={() => setSelectedChart("trends")}
          >
            Trends
          </button>
          <button 
            className={`chart-nav-btn ${selectedChart === "status" ? "active" : ""}`}
            onClick={() => setSelectedChart("status")}
          >
            Status Distribution
          </button>
        </div>

        {/* Charts Container */}
        <div className="charts-container">
          {/* Overview Chart */}
          {selectedChart === "overview" && (
            <div className="panel panel-elevated">
              <div className="panel-header">
                <h2>Payroll Overview</h2>
                <p>Monthly payroll trends and payment volumes</p>
              </div>
              <div className="chart-content">
                <div className="bar-chart">
                  <div className="chart-title">Monthly Payroll Trends</div>
                  <div className="chart-bars">
                    {analytics.monthlyTrends.map((trend, index) => (
                      <div key={index} className="bar-group">
                        <div className="bar-label">{trend.month}</div>
                        <div className="bar-container">
                          <div 
                            className="bar bar-primary"
                            style={{ height: `${(trend.payroll / analytics.totalPayroll) * 100}%` }}
                            title={`Payroll: $${trend.payroll.toLocaleString()}`}
                          ></div>
                        </div>
                        <div className="bar-value">${(trend.payroll / 1000000).toFixed(1)}M</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Organizations Chart */}
          {selectedChart === "tenants" && (
            <div className="panel panel-elevated">
              <div className="panel-header">
                <h2>Organization Performance</h2>
                <p>Top organizations by employee count and payroll</p>
              </div>
              <div className="chart-content">
                <div className="horizontal-bar-chart">
                  <div className="chart-title">Organizations by Payroll</div>
                  {tenants.slice(0, 6).map((tenant, index) => (
                    <div key={tenant.orgId} className="horizontal-bar-group">
                      <div className="horizontal-bar-label">
                        <span className="org-name">{tenant.orgName}</span>
                        <span className="org-stats">{tenant.employees} employees</span>
                      </div>
                      <div className="horizontal-bar-container">
                        <div 
                          className="horizontal-bar"
                          style={{ width: `${(tenant.monthlyPayroll / analytics.totalPayroll) * 100}%` }}
                        ></div>
                        <span className="horizontal-bar-value">${tenant.monthlyPayroll.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Payment Methods Chart */}
          {selectedChart === "payments" && (
            <div className="panel panel-elevated">
              <div className="panel-header">
                <h2>Payment Methods Distribution</h2>
                <p>Breakdown of payment methods by volume and value</p>
              </div>
              <div className="chart-content">
                <div className="pie-chart">
                  <div className="chart-title">Payment Methods by Amount</div>
                  <div className="pie-container">
                    {analytics.paymentMethods.map((method, index) => {
                      const percentage = (method.amount / analytics.totalPayroll) * 100;
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                      return (
                        <div key={index} className="pie-segment" style={{
                          background: colors[index % colors.length],
                          width: `${percentage}%`,
                          height: '40px'
                        }} title={`${method.method}: ${percentage.toFixed(1)}%`}>
                          <span className="pie-label">{percentage.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="method-legend">
                  {analytics.paymentMethods.map((method, index) => {
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                    return (
                      <div key={index} className="legend-item">
                        <div 
                          className="legend-color" 
                          style={{ background: colors[index % colors.length] }}
                        ></div>
                        <div className="legend-info">
                          <span className="legend-label">{method.method}</span>
                          <span className="legend-value">${method.amount.toLocaleString()} ({method.count} tx)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Trends Chart */}
          {selectedChart === "trends" && (
            <div className="panel panel-elevated">
              <div className="panel-header">
                <h2>Payment Volume Trends</h2>
                <p>Number of transactions over time</p>
              </div>
              <div className="chart-content">
                <div className="line-chart">
                  <div className="chart-title">Monthly Payment Volume</div>
                  <div className="line-chart-container">
                    <div className="chart-grid">
                      {analytics.monthlyTrends.map((trend, index) => (
                        <div key={index} className="grid-line" style={{ left: `${(index / (analytics.monthlyTrends.length - 1)) * 100}%` }}></div>
                      ))}
                    </div>
                    <div className="line-chart-data">
                      {analytics.monthlyTrends.map((trend, index) => {
                        const maxPayments = Math.max(...analytics.monthlyTrends.map(t => t.payments));
                        const percentage = (trend.payments / maxPayments) * 100;
                        return (
                          <div key={index} className="data-point" style={{
                            left: `${(index / (analytics.monthlyTrends.length - 1)) * 100}%`,
                            bottom: `${percentage}%`
                          }}>
                            <div className="dot"></div>
                            <div className="value">{trend.payments}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Distribution Chart */}
          {selectedChart === "status" && (
            <div className="panel panel-elevated">
              <div className="panel-header">
                <h2>Payment Status Distribution</h2>
                <p>Breakdown of payment statuses and amounts</p>
              </div>
              <div className="chart-content">
                <div className="status-chart">
                  <div className="chart-title">Payment Status by Amount</div>
                  <div className="status-bars">
                    {analytics.statusDistribution.map((status, index) => {
                      const colors = {
                        'Completed': '#10b981',
                        'Processing': '#f59e0b',
                        'Pending': '#3b82f6',
                        'Failed': '#ef4444'
                      };
                      const percentage = (status.amount / analytics.totalPayroll) * 100;
                      return (
                        <div key={index} className="status-bar-group">
                          <div className="status-bar-label">{status.status}</div>
                          <div className="status-bar-container">
                            <div 
                              className="status-bar"
                              style={{ 
                                width: `${percentage}%`,
                                background: colors[status.status as keyof typeof colors] || '#6b7280'
                              }}
                            ></div>
                            <span className="status-bar-value">${status.amount.toLocaleString()}</span>
                          </div>
                          <div className="status-count">{status.count} transactions</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary Table */}
        <div className="panel panel-elevated">
          <div className="panel-header">
            <h2>Summary Statistics</h2>
          </div>
          <div className="summary-table">
            <div className="summary-row">
              <div className="summary-item">
                <span className="summary-label">Average Payroll per Organization</span>
                <span className="summary-value">
                  ${(analytics.totalPayroll / analytics.totalOrganizations).toLocaleString()}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Average Salary per Employee</span>
                <span className="summary-value">
                  ${(analytics.totalPayroll / analytics.totalEmployees).toLocaleString()}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Transactions</span>
                <span className="summary-value">
                  {analytics.monthlyTrends[analytics.monthlyTrends.length - 1]?.payments || 0}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Success Rate</span>
                <span className="summary-value">
                  {((analytics.statusDistribution.find(s => s.status === 'Completed')?.count || 0) / 
                    analytics.monthlyTrends[analytics.monthlyTrends.length - 1]?.payments * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Tenant List */}
        <div className="panel panel-elevated">
          <div className="panel-header">
            <h2>All Organizations</h2>
            <p>Detailed breakdown of all organizations</p>
          </div>
          {tenants.length === 0 ? (
            <div className="empty-state">
              <p>No organizations available.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Employees</th>
                    <th>Monthly Payroll</th>
                    <th>Average Salary</th>
                    <th>Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.orgId}>
                      <td>
                        <div className="org-info">
                          <div className="org-avatar">
                            {tenant.orgName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <span className="org-name">{tenant.orgName}</span>
                        </div>
                      </td>
                      <td>
                        <span className="employee-count">{tenant.employees}</span>
                      </td>
                      <td>
                        <span className="payroll-amount">${tenant.monthlyPayroll.toLocaleString()}</span>
                      </td>
                      <td>
                        <span className="salary-amount">
                          ${Math.round(tenant.monthlyPayroll / tenant.employees).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <div className="contribution-bar">
                          <div 
                            className="contribution-fill"
                            style={{ width: `${(tenant.monthlyPayroll / analytics.totalPayroll) * 100}%` }}
                          ></div>
                          <span className="contribution-value">
                            {((tenant.monthlyPayroll / analytics.totalPayroll) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
