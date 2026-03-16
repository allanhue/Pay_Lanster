"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api, type Payslip } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

export default function PayslipsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [preview, setPreview] = useState<Payslip | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
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
      api.listPayslips(current.orgId)
        .then((data) => setPayslips(Array.isArray(data) ? data : []))
        .catch(() => setPayslips([]));
    } else {
      setPayslips([]);
    }
  }, [router]);

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
      return matchesSearch && slip.approval === "approved";
    });
  }, [payslips, searchQuery]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredPayslips.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const removePayslip = (id: string) => {
    setPayslips((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => prev.filter((selected) => selected !== id));
  };

  const money = (value: number) =>
    value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const payslipBreakdown = useMemo(() => {
    if (!preview) return null;

    const paye = Math.round(preview.deductions * 0.7 * 100) / 100;
    const nssf = Math.round(preview.deductions * 0.2 * 100) / 100;
    const nhif = Math.max(0, Math.round((preview.deductions - paye - nssf) * 100) / 100);

    return {
      earnings: [{ name: "Basic Pay", amount: preview.gross }],
      deductions: [
        { name: "PAYE (Income Tax)", amount: paye },
        { name: "NSSF", amount: nssf },
        { name: "NHIF", amount: nhif },
      ],
    };
  }, [preview]);

  const buildPayslipEmailHTML = (slip: Payslip) => {
    const orgName = session?.orgName || "Payroll Lanster";
    return `
      <div style="font-family:Segoe UI,Arial,sans-serif;color:#13233f;line-height:1.4">
        <div style="border:1px solid #d9e0eb;border-radius:12px;overflow:hidden">
          <div style="padding:16px 18px;background:linear-gradient(135deg,#007c91,#00af8a);color:white">
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
                <div style="display:flex;justify-content:space-between;margin-top:6px"><span>Gross</span><strong>$${money(slip.gross)}</strong></div>
                <div style="display:flex;justify-content:space-between;margin-top:4px"><span>Deductions</span><strong>$${money(slip.deductions)}</strong></div>
                <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px dashed #d9e0eb"><span>Net Pay</span><strong>$${money(slip.net)}</strong></div>
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
    document.body.classList.add("print-payslip");
    window.print();
  };

  const onEmailPayslip = async () => {
    if (!preview) return;
    setEmailStatus(null);
    setSendingEmail(true);
    try {
      const res = await api.sendMail({
        to: [preview.email],
        subject: `Payslip (${preview.period}) - ${preview.employee}`,
        html: buildPayslipEmailHTML(preview),
      });
      setEmailStatus({ ok: true, message: res.message || "Email sent" });
    } catch (err) {
      setEmailStatus({ ok: false, message: err instanceof Error ? err.message : "Failed to send email" });
    } finally {
      setSendingEmail(false);
    }
  };

  const onBulkEmail = async () => {
    const recipients = payslips.filter((item) => selectedIds.includes(item.id));
    if (recipients.length === 0) {
      setBulkStatus({ ok: false, message: "Select payslips to email." });
      return;
    }

    setBulkStatus(null);
    setBulkSending(true);
    try {
      for (const slip of recipients) {
        await api.sendMail({
          to: [slip.email],
          subject: `Payslip (${slip.period}) - ${slip.employee}`,
          html: buildPayslipEmailHTML(slip),
        });
      }
      setBulkStatus({ ok: true, message: `Sent ${recipients.length} payslips.` });
    } catch (err) {
      setBulkStatus({ ok: false, message: err instanceof Error ? err.message : "Failed to send emails" });
    } finally {
      setBulkSending(false);
    }
  };

  if (!session) return <main className="centered">Loading...</main>;

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide">
        <div className="page-header">
          <h1>Payslips</h1>
          <p>Review, print (PDF), and email approved payslips. Payslips appear after payruns are approved.</p>
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
            {bulkStatus && (
              <div className={`status-pill ${bulkStatus.ok ? "status-pill-success" : "status-pill-error"}`}>
                {bulkStatus.message}
              </div>
            )}
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredPayslips.length}
                    onChange={(event) => toggleSelectAll(event.target.checked)}
                  />
                </th>
                <th>Slip ID</th>
                <th>Employee</th>
                <th>Period</th>
                <th>Gross</th>
                <th>Deductions</th>
                <th>Net</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayslips.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedIds((prev) => [...prev, item.id]);
                        } else {
                          setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                        }
                      }}
                    />
                  </td>
                  <td><strong>{item.id}</strong></td>
                  <td>
                    <div className="payslip-employee">
                      <span className="payslip-employee-name">{item.employee}</span>
                      <span className="payslip-employee-email">{item.email}</span>
                    </div>
                  </td>
                  <td>{item.period}</td>
                  <td>${money(item.gross)}</td>
                  <td>${money(item.deductions)}</td>
                  <td><strong>${money(item.net)}</strong></td>
                  <td>
                    <div className="inline-actions">
                      <button className="secondary" type="button" onClick={() => { setPreview(item); setEmailStatus(null); }}>
                        View / Print
                      </button>
                      <button className="danger" type="button" onClick={() => removePayslip(item.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        {preview && payslipBreakdown && (
          <div className="payslip-modal" role="dialog" aria-modal="true" aria-label="Payslip preview">
            <button className="payslip-modal-backdrop" type="button" onClick={() => setPreview(null)} aria-label="Close preview" />
            <div className="payslip-modal-card">
              <div className="payslip-actions">
                <div className="payslip-actions-left">
                  <h2 className="payslip-preview-title">Payslip Preview</h2>
                  <p className="payslip-preview-subtitle">{preview.employee} | {preview.period} | {preview.id}</p>
                </div>
                <div className="payslip-actions-right">
                  <button type="button" className="secondary" onClick={onPrint}>
                    Print / Save PDF
                  </button>
                  <button type="button" onClick={onEmailPayslip} disabled={sendingEmail}>
                    {sendingEmail ? "Sending..." : "Email"}
                  </button>
                  <button type="button" className="danger" onClick={() => setPreview(null)}>
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
                    <div className="payslip-brand-dot" />
                    <div>
                      <div className="payslip-org">{session.orgName || "Payroll Lanster"}</div>
                      <div className="payslip-title">Payslip</div>
                    </div>
                  </div>
                  <div className="payslip-meta">
                    <div><span>Period</span><strong>{preview.period}</strong></div>
                    <div><span>Slip ID</span><strong>{preview.id}</strong></div>
                  </div>
                </div>

                <div className="payslip-sheet-grid">
                  <div className="payslip-kv">
                    <div className="payslip-kv-label">Employee</div>
                    <div className="payslip-kv-value">{preview.employee}</div>
                    <div className="payslip-kv-sub">{preview.email}</div>
                  </div>
                  <div className="payslip-kv">
                    <div className="payslip-kv-label">Pay Summary</div>
                    <div className="payslip-summary">
                      <div><span>Gross</span><strong>${money(preview.gross)}</strong></div>
                      <div><span>Deductions</span><strong>${money(preview.deductions)}</strong></div>
                      <div className="payslip-net"><span>Net Pay</span><strong>${money(preview.net)}</strong></div>
                    </div>
                  </div>
                </div>

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
                            <td className="right">${money(row.amount)}</td>
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
                            <td className="right">${money(row.amount)}</td>
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
          </div>
        )}
      </section>
    </main>
  );
}
