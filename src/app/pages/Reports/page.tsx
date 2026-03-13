"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

export default function ReportsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [reports, setReports] = useState<Array<{ id: string; title: string; period: string; category: string; status: string; updatedAt: string }>>([]);
  const [fileType, setFileType] = useState("PDF");
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
    api.getDemoData().then((data) => {
      setReports(Array.isArray(data.reports) ? data.reports : []);
    }).catch(() => {
      setReports([]);
    });
  }, [router]);

  const readyReports = useMemo(() => reports.filter((report) => report.status === "ready").length, [reports]);

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide">
        <div className="page-header">
          <h1>Reports</h1>
          <p>Generate payroll reports in multiple file formats.</p>
        </div>

        <div className="cards-grid three-col">
          <article className="card card-metric">
            <span className="metric-label">Reports Ready</span>
            <span className="metric-value">{readyReports}</span>
            <span className="metric-sublabel">Available to export</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">File Type</span>
            <span className="metric-value">{fileType}</span>
            <span className="metric-sublabel">Selected format</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Last Update</span>
            <span className="metric-value">{reports[0]?.updatedAt || "—"}</span>
            <span className="metric-sublabel">Recent refresh</span>
          </article>
        </div>

        <div className="panel panel-elevated">
          <div className="panel-header">
            <div>
              <h2>Export Settings</h2>
              <p>Select file type and generate a styled export.</p>
            </div>
            <div className="panel-meta">
              <select className="file-type-select" value={fileType} onChange={(e) => setFileType(e.target.value)}>
                <option value="PDF">PDF</option>
                <option value="CSV">CSV</option>
                <option value="XLSX">XLSX</option>
              </select>
              <button className="btn btn-primary btn-sm" type="button">
                Generate Export
              </button>
            </div>
          </div>
          <div className="export-grid">
            <article className="export-card">
              <h3>Payroll Summary</h3>
              <p>Gross vs net by department, with totals and variances.</p>
              <span className="status-badge status-approved">Styled {fileType}</span>
            </article>
            <article className="export-card">
              <h3>Statutory Remittance</h3>
              <p>PAYE, NSSF, NHIF deductions with period totals.</p>
              <span className="status-badge status-processing">Ready</span>
            </article>
            <article className="export-card">
              <h3>Loan Schedules</h3>
              <p>Active loan balances and repayment schedules.</p>
              <span className="status-badge status-pending">Draft</span>
            </article>
          </div>
        </div>

        <article className="panel panel-elevated">
          <div className="panel-header">
            <h2>Generated Reports</h2>
            <p>Browse and export existing reports.</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Category</th>
                <th>Period</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.title}</td>
                  <td>{report.category}</td>
                  <td>{report.period}</td>
                  <td>
                    <span className={`status-badge ${report.status === "ready" ? "status-approved" : "status-pending"}`}>
                      {report.status}
                    </span>
                  </td>
                  <td>{report.updatedAt}</td>
                  <td>
                    <button className="secondary" type="button">
                      Export {fileType}
                    </button>
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
