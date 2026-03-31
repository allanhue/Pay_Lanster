"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import ModuleActions from "@/app/components/ModuleActions";
import { api, type Payrun, type Payslip, type PayrollEmployee, type SettingsPayload } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";
import { getOrgLogo } from "@/app/lib/orgAssets";

export default function PayslipsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayrun, setSelectedPayrun] = useState("latest");
  const [approvalFilter, setApprovalFilter] = useState<"all" | "approved" | "pending" | "rejected">("all");
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [orgSettings, setOrgSettings] = useState<SettingsPayload | null>(null);
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
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
    if (current.orgId) {
      setOrgLogo(getOrgLogo(current.orgId));
    }
    if (current.orgId) {
      api.listPayslips(current.orgId)
        .then((data) => setPayslips(Array.isArray(data) ? data : []))
        .catch(() => setPayslips([]));
      api.listPayruns(current.orgId)
        .then((data) => setPayruns(Array.isArray(data) ? data : []))
        .catch(() => setPayruns([]));
      api.getSettings(current.orgId)
        .then((data) => setOrgSettings(data))
        .catch(() => setOrgSettings(null));
      api.listEmployees(current.orgId)
        .then((data) => setEmployees(Array.isArray(data) ? data : []))
        .catch(() => setEmployees([]));
    } else {
      setPayslips([]);
      setPayruns([]);
      setEmployees([]);
    }
  }, [router]);

  const payrunPeriods = useMemo(() => {
    const fromPayruns = payruns.map((payrun) => payrun.period).filter(Boolean);
    const raw = fromPayruns.length > 0 ? fromPayruns : payslips.map((slip) => slip.period);
    return Array.from(new Set(raw));
  }, [payruns, payslips]);

  const latestPeriod = useMemo(() => {
    if (payruns.length > 0) {
      const sorted = [...payruns].sort(
        (a, b) => new Date(b.payday).getTime() - new Date(a.payday).getTime()
      );
      return sorted[0]?.period ?? "";
    }
    const unique = Array.from(new Set(payslips.map((slip) => slip.period))).sort();
    return unique.length > 0 ? unique[unique.length - 1] : "";
  }, [payruns, payslips]);

  useEffect(() => {
    const onAfterPrint = () => {
      document.body.classList.remove("print-payslip");
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  const summary = useMemo(() => {
    const total = payslips.length;
    const uniquePeriods = new Set(payslips.map((slip) => slip.period)).size;
    const recipients = new Set(payslips.map((slip) => slip.email)).size;
    return { total, uniquePeriods, recipients };
  }, [payslips]);

  const filteredPayslips = useMemo(() => {
    return payslips.filter((slip) => {
      const matchesSearch =
        searchQuery === "" ||
        slip.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        slip.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        slip.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPeriod =
        selectedPayrun === "all"
          ? true
          : selectedPayrun === "latest"
            ? latestPeriod === "" || slip.period === latestPeriod
            : slip.period === selectedPayrun;
      const matchesApproval =
        approvalFilter === "all" ? true : slip.approval === approvalFilter;
      return matchesSearch && matchesPeriod && matchesApproval;
    });
  }, [payslips, searchQuery, selectedPayrun, latestPeriod, approvalFilter]);

  const removePayslip = (id: string) => {
    setPayslips((prev) => prev.filter((item) => item.id !== id));
  };

  const currency = orgSettings?.currency || "USD";
  const money = (value: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
    } catch {
      return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  const employeeIndex = useMemo(() => {
    const byEmail = new Map<string, PayrollEmployee>();
    const byName = new Map<string, PayrollEmployee>();
    employees.forEach((emp) => {
      if (emp.email) byEmail.set(emp.email.toLowerCase(), emp);
      if (emp.fullName) byName.set(emp.fullName.toLowerCase(), emp);
    });
    return { byEmail, byName };
  }, [employees]);

  const payslipBreakdown = useMemo(() => {
    if (!selectedPayslip) return null;

    const taxRate = orgSettings?.taxRate ?? 0;
    const pensionRate = orgSettings?.pensionRate ?? 0;
    const paye = Math.round((selectedPayslip.gross * taxRate / 100) * 100) / 100;
    const pension = Math.round((selectedPayslip.gross * pensionRate / 100) * 100) / 100;
    const statutory = Math.max(0, Math.round((selectedPayslip.deductions - paye - pension) * 100) / 100);

    return {
      earnings: [{ name: "Basic Pay", amount: selectedPayslip.gross }],
      deductions: [
        { name: "PAYE (Income Tax)", amount: paye },
        { name: "Pension", amount: pension },
        { name: "Statutory Deductions", amount: statutory },
      ],
    };
  }, [selectedPayslip, orgSettings]);

  const selectedEmployee = useMemo(() => {
    if (!selectedPayslip) return null;
    const byEmail = employeeIndex.byEmail.get(selectedPayslip.email.toLowerCase());
    if (byEmail) return byEmail;
    return employeeIndex.byName.get(selectedPayslip.employee.toLowerCase()) ?? null;
  }, [employeeIndex, selectedPayslip]);

  const buildPayslipEmailHTML = (slip: Payslip) => {
    const orgName = session?.orgName || "Payroll Lanster";
    const logo = session?.orgId ? getOrgLogo(session.orgId) : null;
    return `
      <div style="font-family:Segoe UI,Arial,sans-serif;color:#13233f;line-height:1.4">
        <div style="border:1px solid #d9e0eb;border-radius:12px;overflow:hidden">
          <div style="padding:16px 18px;background:linear-gradient(135deg,#007c91,#00af8a);color:white">
            ${logo ? `<img src="${logo}" alt="${orgName}" style="height:34px;margin-bottom:8px;border-radius:8px;background:#fff;padding:4px"/>` : ""}
            <div style="font-size:14px;opacity:.9">${orgName}</div>
            <div style="font-size:20px;font-weight:700;margin-top:4px">Payslip</div>
            <div style="margin-top:6px;font-size:13px;opacity:.95">Period: ${slip.period} | Slip ID: ${slip.id}</div>
          </div>
          <div style="padding:18px">
            <div style="display:flex;gap:16px;flex-wrap:wrap">
              <div style="flex:1;min-width:220px;border:1px solid #edf1f6;border-radius:10px;padding:12px">
                <div style="font-size:12px;color:#5e6f89;text-transform:uppercase;letter-spacing:.06em">Employee</div>
                <div style="font-weight:700;margin-top:4px">${slip.employee}</div>
                <div style="color:#5e6f89;margin-top:2px">${slip.email}</div>
              </div>
              <div style="flex:1;min-width:220px;border:1px solid #edf1f6;border-radius:10px;padding:12px">
                <div style="font-size:12px;color:#5e6f89;text-transform:uppercase;letter-spacing:.06em">Summary</div>
                <div style="display:flex;justify-content:space-between;margin-top:6px"><span>Gross</span><strong>${money(slip.gross)}</strong></div>
                <div style="display:flex;justify-content:space-between;margin-top:4px"><span>Deductions</span><strong>${money(slip.deductions)}</strong></div>
                <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px dashed #d9e0eb"><span>Net Pay</span><strong>${money(slip.net)}</strong></div>
              </div>
            </div>
            <div style="margin-top:16px;border-top:1px solid #edf1f6;padding-top:12px;font-size:12px;color:#5e6f89">
              This payslip is generated by ${orgName}. If you notice any discrepancy, contact your payroll administrator.
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const onPrint = () => {
    if (!selectedPayslip) return;
    document.body.classList.add("print-payslip");
    window.print();
  };

  const onEmailPayslip = async () => {
    if (!selectedPayslip) return;
    setEmailStatus(null);
    setSendingEmail(true);
    try {
      const res = await api.sendMail({
        to: [selectedPayslip.email],
        subject: `Payslip (${selectedPayslip.period}) - ${selectedPayslip.employee}`,
        html: buildPayslipEmailHTML(selectedPayslip),
      });
      setEmailStatus({ ok: true, message: res.message || "Email sent" });
    } catch (err) {
      setEmailStatus({ ok: false, message: err instanceof Error ? err.message : "Failed to send email" });
    } finally {
      setSendingEmail(false);
    }
  };

  if (!session) return <main className="centered">Loading...</main>;

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide payslip-layout">
        <div className="payslip-list">
          <div className="page-header">
            <div className="page-header-content">
              <h1>Payslips</h1>
              <p>Review, print (PDF), and email payslips by status. Payslips appear after payruns are approved.</p>
            </div>
            <ModuleActions />
          </div>

          <div className="cards-grid three-col">
            <article className="card card-metric">
              <span className="metric-label">Total Payslips</span>
              <span className="metric-value">{summary.total}</span>
              <span className="metric-sublabel">Approved only</span>
            </article>
            <article className="card card-metric">
              <span className="metric-label">Pay Periods</span>
              <span className="metric-value">{summary.uniquePeriods}</span>
              <span className="metric-sublabel">Unique periods</span>
            </article>
            <article className="card card-metric">
              <span className="metric-label">Recipients</span>
              <span className="metric-value">{summary.recipients}</span>
              <span className="metric-sublabel">Unique emails</span>
            </article>
          </div>

          <article className="panel panel-elevated">
            <div className="filter-row">
              <div className="form-group">
                <label htmlFor="payslipSearch">Search</label>
                <input
                  id="payslipSearch"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by employee, email, or slip ID"
                />
              </div>
              <div className="form-group">
                <label htmlFor="payslipPeriod">Payrun Period</label>
                <select
                  id="payslipPeriod"
                  value={selectedPayrun}
                  onChange={(event) => setSelectedPayrun(event.target.value)}
                >
                  <option value="latest">Latest payrun</option>
                  <option value="all">All periods</option>
                  {payrunPeriods.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="payslipApproval">Approval</label>
                <select
                  id="payslipApproval"
                  value={approvalFilter}
                  onChange={(event) => setApprovalFilter(event.target.value as typeof approvalFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Slip ID</th>
                  <th>Employee</th>
                  <th>Period</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayslips.map((item) => (
                  <tr key={item.id} onClick={() => { setSelectedPayslip(item); setEmailStatus(null); setMenuOpen(null); }}>
                    <td><strong>{item.id}</strong></td>
                    <td>
                      <div className="payslip-employee">
                        <span className="payslip-employee-name">{item.employee}</span>
                        <span className="payslip-employee-email">{item.email}</span>
                      </div>
                    </td>
                    <td>{item.period}</td>
                    <td>{money(item.gross)}</td>
                    <td>{money(item.deductions)}</td>
                    <td><strong>{money(item.net)}</strong></td>
                    <td>
                      <span className={`status-badge status-${item.approval}`}>
                        {item.approval}
                      </span>
                    </td>
                    <td className="action-cell">
                      <button
                        className="action-menu-btn"
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === item.id ? null : item.id); }}
                        aria-label="Payslip actions"
                      >
                        <svg viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.6" fill="currentColor" />
                          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                          <circle cx="12" cy="19" r="1.6" fill="currentColor" />
                        </svg>
                      </button>
                      {menuOpen === item.id && (
                        <>
                          <button className="popover-backdrop" type="button" onClick={() => setMenuOpen(null)} />
                          <div className="action-popover">
                            <button
                              className="action-popover-item"
                              type="button"
                              onClick={() => { setSelectedPayslip(item); setEmailStatus(null); setMenuOpen(null); }}
                            >
                              View / Print
                            </button>
                            <button
                              className="action-popover-item"
                              type="button"
                              onClick={async () => { 
                                setEmailStatus(null); 
                                setSendingEmail(true); 
                                try { 
                                  const res = await api.sendMail({ 
                                    to: [item.email], 
                                    subject: `Payslip (${item.period}) - ${item.employee}`, 
                                    html: buildPayslipEmailHTML(item), 
                                  }); 
                                  setEmailStatus({ ok: true, message: res.message || "Email sent" }); 
                                } catch (err) { 
                                  setEmailStatus({ ok: false, message: err instanceof Error ? err.message : "Failed to send email" }); 
                                } finally { 
                                  setSendingEmail(false); 
                                } 
                                setMenuOpen(null); 
                              }}
                            >
                              Email
                            </button>
                            <button
                              className="action-popover-item danger"
                              type="button"
                              onClick={() => { removePayslip(item.id); setMenuOpen(null); }}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>

        {selectedPayslip && payslipBreakdown && (
          <div className="payslip-side-panel">
            <div className="payslip-actions">
              <div className="payslip-actions-left">
                <h2 className="payslip-preview-title">Payslip Preview</h2>
                <p className="payslip-preview-subtitle">{selectedPayslip.employee} | {selectedPayslip.period} | {selectedPayslip.id}</p>
              </div>
              <div className="payslip-actions-right">
                <button type="button" className="secondary" onClick={onPrint}>
                  Print / Save PDF
                </button>
                <button type="button" onClick={onEmailPayslip} disabled={sendingEmail}>
                  {sendingEmail ? "Sending..." : "Email"}
                </button>
                <button type="button" className="danger" onClick={() => setSelectedPayslip(null)}>
                  Close
                </button>
              </div>
            </div>

            {emailStatus && (
              <div className={`alert ${emailStatus.ok ? "alert-success" : "alert-error"}`}>
                {emailStatus.message}
              </div>
            )}

            <div className="payslip-sheet">
              <div className="payslip-sheet-header">
                <div className="payslip-brand">
                  {orgLogo ? (
                    <img className="payslip-brand-logo" src={orgLogo} alt={`${session.orgName ?? "Organization"} logo`} />
                  ) : (
                    <div className="payslip-brand-dot" />
                  )}
                  <div>
                    <div className="payslip-org">{session.orgName || "Payroll Lanster"}</div>
                    <div className="payslip-title">Payslip</div>
                  </div>
                </div>
                <div className="payslip-meta">
                  <div><span>Period</span><strong>{selectedPayslip.period}</strong></div>
                  <div><span>Slip ID</span><strong>{selectedPayslip.id}</strong></div>
                  <div><span>Currency</span><strong>{currency}</strong></div>
                  <div><span>Pay Cycle</span><strong>{selectedEmployee?.payCycle || orgSettings?.payCycle || "—"}</strong></div>
                </div>
              </div>

              <div className="payslip-sheet-grid">
                <div className="payslip-kv">
                  <div className="payslip-kv-label">Employee</div>
                  <div className="payslip-kv-value">{selectedPayslip.employee}</div>
                  <div className="payslip-kv-sub">{selectedPayslip.email}</div>
                </div>
                <div className="payslip-kv">
                  <div className="payslip-kv-label">Pay Summary</div>
                  <div className="payslip-summary">
                    <div><span>Gross</span><strong>{money(selectedPayslip.gross)}</strong></div>
                    <div><span>Deductions</span><strong>{money(selectedPayslip.deductions)}</strong></div>
                    <div className="payslip-net"><span>Net Pay</span><strong>{money(selectedPayslip.net)}</strong></div>
                  </div>
                </div>
              </div>

              {selectedEmployee && (
                <div className="payslip-sheet-grid payslip-details-grid">
                  <div className="payslip-kv">
                    <div className="payslip-kv-label">Employee Details</div>
                    <div className="payslip-detail-row"><span>Department</span><strong>{selectedEmployee.department}</strong></div>
                    <div className="payslip-detail-row"><span>Title</span><strong>{selectedEmployee.title || "—"}</strong></div>
                    <div className="payslip-detail-row"><span>Position</span><strong>{selectedEmployee.position || "—"}</strong></div>
                    <div className="payslip-detail-row"><span>Pay Cycle</span><strong>{selectedEmployee.payCycle || "—"}</strong></div>
                  </div>
                  <div className="payslip-kv">
                    <div className="payslip-kv-label">Payroll Details</div>
                    <div className="payslip-detail-row"><span>Annual Salary</span><strong>{money(selectedEmployee.salary)}</strong></div>
                    <div className="payslip-detail-row"><span>Contract</span><strong>{selectedEmployee.contractType || "—"}</strong></div>
                    <div className="payslip-detail-row"><span>Tax ID</span><strong>{selectedEmployee.taxId || "—"}</strong></div>
                    <div className="payslip-detail-row"><span>NSSF / NHIF</span><strong>{`${selectedEmployee.nssf || "—"} / ${selectedEmployee.nhif || "—"}`}</strong></div>
                  </div>
                  <div className="payslip-kv">
                    <div className="payslip-kv-label">Payment Details</div>
                    <div className="payslip-detail-row"><span>Bank</span><strong>{selectedEmployee.bankName || "—"}</strong></div>
                    <div className="payslip-detail-row"><span>Account Name</span><strong>{selectedEmployee.bankAccountName || "—"}</strong></div>
                    <div className="payslip-detail-row"><span>Account No.</span><strong>{selectedEmployee.bankAccount || "—"}</strong></div>
                    <div className="payslip-detail-row"><span>Location</span><strong>{selectedEmployee.location || "—"}</strong></div>
                  </div>
                </div>
              )}

              <div className="payslip-split">
                <div className="payslip-split-card">
                  <h3>Earnings</h3>
                  <table className="payslip-table">
                    <thead>
                      <tr><th>Description</th><th className="right">Amount</th></tr>
                    </thead>
                    <tbody>
                      {payslipBreakdown.earnings.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td className="right">{money(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="payslip-split-card">
                  <h3>Deductions</h3>
                  <table className="payslip-table">
                    <thead>
                      <tr><th>Description</th><th className="right">Amount</th></tr>
                    </thead>
                    <tbody>
                      {payslipBreakdown.deductions.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td className="right">{money(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="payslip-footer-note">
                This template is print-ready. Use your browser's print dialog to save as PDF.
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
