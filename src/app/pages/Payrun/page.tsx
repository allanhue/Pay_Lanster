"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import ModuleActions from "@/app/components/ModuleActions";
import { api, type Payrun } from "@/app/lib/api";
import { addNotification } from "@/app/lib/notifications";
import { readSession, type UserSession } from "@/app/lib/session";

type PayrunRow = Payrun;

type DeductionItem = {
  name: string;
  type: "statutory" | "tax" | "loan" | "other";
  rate: number;
  amount: number;
  applicable: boolean;
};

type EmployeePayroll = {
  id: string;
  name: string;
  department: string;
  grossSalary: number;
  deductions: DeductionItem[];
  netPay: number;
};

const defaultDeductions: DeductionItem[] = [
  { name: "PAYE (Income Tax)", type: "tax", rate: 30, amount: 0, applicable: true },
  { name: "NSSF", type: "statutory", rate: 6, amount: 0, applicable: true },
  { name: "NHIF", type: "statutory", rate: 2.75, amount: 0, applicable: true },
  { name: "Housing Levy", type: "statutory", rate: 1.5, amount: 0, applicable: true },
  { name: "Loan Repayment", type: "loan", rate: 0, amount: 0, applicable: false },
  { name: "Advance Recovery", type: "other", rate: 0, amount: 0, applicable: false },
];

export default function PayrunPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const router = useRouter();
  const [payruns, setPayruns] = useState<PayrunRow[]>([]);
  const [employees, setEmployees] = useState<EmployeePayroll[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "create" | "history">("overview");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [deductions, setDeductions] = useState<DeductionItem[]>(defaultDeductions);
  const [period, setPeriod] = useState("");
  const [payDate, setPayDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [openEmployeeMenu, setOpenEmployeeMenu] = useState<string | null>(null);
  const [openEmployeeBulkMenu, setOpenEmployeeBulkMenu] = useState(false);
  const [openPayrunMenu, setOpenPayrunMenu] = useState<string | null>(null);
  const [showStatutoryModal, setShowStatutoryModal] = useState(false);
  const [statutoryNote, setStatutoryNote] = useState("");
  const [statutoryStatus, setStatutoryStatus] = useState<string | null>(null);

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
      api.listEmployees(current.orgId)
        .then((data) => {
          const payrollEmployees = (Array.isArray(data) ? data : []).map((emp: any) => ({
            id: emp.id,
            name: emp.fullName,
            department: emp.department,
            grossSalary: emp.salary / 12,
            deductions: defaultDeductions.map(d => ({ ...d })),
            netPay: 0,
          }));
          setEmployees(payrollEmployees);
          setSelectedEmployees(payrollEmployees.map(e => e.id));
        })
        .catch(() => setEmployees([]));

      api.listPayruns(current.orgId)
        .then((data) => setPayruns(Array.isArray(data) ? data : []))
        .catch(() => setPayruns([]));
    }
  }, [router]);

  const totals = useMemo(() => ({
    totalPayroll: payruns.reduce((acc, row) => acc + row.netPayroll, 0),
    totalGross: payruns.reduce((acc, row) => acc + row.grossPay, 0),
    totalDeductions: payruns.reduce((acc, row) => acc + row.deductions, 0),
    upcoming: payruns.find((row) => row.status === "draft"),
    completed: payruns.filter((row) => row.status === "completed").length,
  }), [payruns]);

  const calculateNetPay = (gross: number, emplDeductions: DeductionItem[]) => {
    let totalDeductions = 0;
    emplDeductions.forEach(d => {
      if (d.applicable) {
        if (d.rate > 0) totalDeductions += (gross * d.rate) / 100;
        else if (d.amount > 0) totalDeductions += d.amount;
      }
    });
    return { net: gross - totalDeductions, deductions: totalDeductions };
  };

  const handleRunPayroll = async (e: FormEvent) => {
    e.preventDefault();
    if (!period || !payDate || selectedEmployees.length === 0) {
      setError("Please fill all fields and select at least one employee");
      return;
    }

    setIsProcessing(true);
    setError("");
    setMessage("");
    try {
      const selectedEmpls = employees.filter(e => selectedEmployees.includes(e.id));
      let totalGross = 0;
      let totalNet = 0;
      let totalDeductions = 0;

      selectedEmpls.forEach(emp => {
        const { net, deductions: empDeds } = calculateNetPay(emp.grossSalary, deductions);
        totalGross += emp.grossSalary;
        totalNet += net;
        totalDeductions += empDeds;
      });

      if (!session?.orgId) return;

      const newPayrun = await api.createPayrun({
        orgId: session.orgId,
        period,
        payday: payDate,
        grossPay: totalGross,
        netPayroll: totalNet,
        deductions: totalDeductions,
        employees: selectedEmpls.length,
        status: "draft",
      });

      setPayruns((prev) => [newPayrun, ...prev]);
      addNotification({
        title: "Payrun created",
        detail: `${newPayrun.id} - ${newPayrun.period} - ${selectedEmpls.length} employees`,
        tag: "payrun",
        link: "/pages/Payrun",
      });
      setMessage(`Payroll created for ${period} with ${selectedEmpls.length} employees`);
      setActiveTab("overview");
    } catch {
      setError("Could not create payrun");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleDeduction = (index: number) => {
    setDeductions(prev => prev.map((d, i) =>
      i === index ? { ...d, applicable: !d.applicable } : d
    ));
  };

  const updateDeductionAmount = (index: number, amount: number) => {
    setDeductions(prev => prev.map((d, i) =>
      i === index ? { ...d, amount } : d
    ));
  };

  const submitStatutoryRequest = async () => {
    if (!session) return;
    setStatutoryStatus(null);
    try {
      await api.sendSupport({
        name: session.name,
        email: session.email,
        subject: "Custom statutory deduction request",
        message: `Organization: ${session.orgName || "Org Admin"}\n\nRequest:\n${statutoryNote || "Please enable custom statutory deductions."}`,
      });
      setStatutoryStatus("Request sent. A system admin must approve this change.");
      setShowStatutoryModal(false);
      setStatutoryNote("");
    } catch (err) {
      setStatutoryStatus(err instanceof Error ? err.message : "Failed to send request");
    }
  };

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content" style={{ padding: "2rem 2.5rem" }}>

        {/* Page Header */}
        <div className="page-header" style={{ marginBottom: "1.75rem" }}>
          <div className="page-header-content">
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>Payroll Center</h1>
            <p style={{ fontSize: "0.875rem", opacity: 0.6, margin: 0 }}>
              Manage payroll runs, process payments, and review payrun history.
            </p>
          </div>
          <ModuleActions />
        </div>

        {/* Alerts */}
        {message && (
          <div className="alert alert-success" style={{ marginBottom: "1.25rem", padding: "0.875rem 1.25rem", borderRadius: "0.5rem" }}>
            {message}
          </div>
        )}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.25rem", padding: "0.875rem 1.25rem", borderRadius: "0.5rem" }}>
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="tabs" style={{ marginBottom: "1.75rem" }}>
          <button className={`tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Overview
          </button>
          <button className={`tab ${activeTab === "create" ? "active" : ""}`} onClick={() => setActiveTab("create")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Run Payroll
          </button>
          <button className={`tab ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8v4l3 3M3 12a9 9 0 1018 0 9 9 0 00-18 0z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            History
          </button>
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            <div className="cards-grid four-col" style={{ gap: "1.25rem", marginBottom: "1.75rem" }}>
              <div className="card card-metric" style={{ padding: "1.25rem 1.5rem" }}>
                <span className="metric-label">Upcoming Payrun</span>
                <strong className="metric-value">{totals.upcoming?.period || "None scheduled"}</strong>
                <span className="metric-sublabel">{totals.upcoming?.payday || "—"}</span>
              </div>
              <div className="card card-metric" style={{ padding: "1.25rem 1.5rem" }}>
                <span className="metric-label">Total Employees</span>
                <strong className="metric-value">{employees.length}</strong>
                <span className="metric-sublabel">Active for payroll</span>
              </div>
              <div className="card card-metric" style={{ padding: "1.25rem 1.5rem" }}>
                <span className="metric-label">Total Gross</span>
                <strong className="metric-value">${totals.totalGross.toLocaleString()}</strong>
                <span className="metric-sublabel">YTD processed</span>
              </div>
              <div className="card card-metric" style={{ padding: "1.25rem 1.5rem" }}>
                <span className="metric-label">Completed Runs</span>
                <strong className="metric-value">{totals.completed}</strong>
                <span className="metric-sublabel">This year</span>
              </div>
            </div>

            <div className="panel panel-elevated" style={{ padding: "1.5rem" }}>
              <div className="panel-header" style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Quick Actions</h2>
              </div>
              <div className="action-grid" style={{ gap: "1rem" }}>
                <button className="action-card" style={{ padding: "1.25rem 1rem" }} onClick={() => setActiveTab("create")}>
                  <span className="action-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "1.75rem", height: "1.75rem" }}>
                      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="action-title">Run New Payroll</span>
                  <span className="action-desc">Process monthly or biweekly payroll</span>
                </button>
                <button className="action-card" style={{ padding: "1.25rem 1rem" }} onClick={() => router.push("/pages/Payslips")}>
                  <span className="action-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "1.75rem", height: "1.75rem" }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <polyline points="14,2 14,8 20,8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" />
                      <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                  <span className="action-title">Generate Payslips</span>
                  <span className="action-desc">Bulk generate employee payslips</span>
                </button>
                <button className="action-card" style={{ padding: "1.25rem 1rem" }} onClick={() => router.push("/pages/Reports")}>
                  <span className="action-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "1.75rem", height: "1.75rem" }}>
                      <path d="M3 3v18h18" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="action-title">View Reports</span>
                  <span className="action-desc">Payroll summary and analytics</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── CREATE / RUN PAYROLL TAB ── */}
        {activeTab === "create" && (
          <form onSubmit={handleRunPayroll} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* ── Step 1: Payroll Period & Date ── */}
            <div className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: "1.75rem", height: "1.75rem", borderRadius: "50%",
                  background: "var(--accent)", color: "#fff",
                  fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
                }}>1</span>
                <div>
                  <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Payroll Details</h2>
                  <p style={{ fontSize: "0.8125rem", opacity: 0.55, margin: "0.125rem 0 0" }}>Set the pay period and scheduled payment date</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.25rem" }}>

                {/* Month picker */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.4rem" }}>
                    Month <span style={{ color: "var(--error, #ef4444)" }}>*</span>
                  </label>
                  <select
                    value={period.split(" ")[0] || ""}
                    onChange={(e) => {
                      const yr = period.split(" ")[1] || new Date().getFullYear().toString();
                      setPeriod(e.target.value ? `${e.target.value} ${yr}` : "");
                    }}
                    required
                    style={{ width: "100%", padding: "0.625rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box", background: "var(--surface, #fff)" }}
                  >
                    <option value="">Select month</option>
                    {["January","February","March","April","May","June","July","August","September","October","November","December"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Year picker */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.4rem" }}>
                    Year <span style={{ color: "var(--error, #ef4444)" }}>*</span>
                  </label>
                  <select
                    value={period.split(" ")[1] || new Date().getFullYear().toString()}
                    onChange={(e) => {
                      const mo = period.split(" ")[0] || "";
                      setPeriod(mo ? `${mo} ${e.target.value}` : "");
                    }}
                    style={{ width: "100%", padding: "0.625rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box", background: "var(--surface, #fff)" }}
                  >
                    {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Payment date */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="payDate" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.4rem" }}>
                    Payment Date <span style={{ color: "var(--error, #ef4444)" }}>*</span>
                  </label>
                  <input
                    id="payDate"
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                    style={{ width: "100%", padding: "0.625rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }}
                  />
                </div>

              </div>

              {/* Derived period preview */}
              {period && payDate && (
                <div style={{
                  marginTop: "1.25rem", padding: "0.75rem 1rem", borderRadius: "0.4rem",
                  background: "var(--accent-subtle)", border: "1px solid var(--accent-light)",
                  display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6 }}>Pay Period</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{period}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6 }}>Payday</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{new Date(payDate).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6 }}>Frequency</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>Monthly</div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Step 2: Employees ── */}
            <div className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: "1.75rem", height: "1.75rem", borderRadius: "50%",
                    background: "var(--accent)", color: "#fff",
                    fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
                  }}>2</span>
                  <div>
                    <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Employees
                      <span style={{
                        marginLeft: "0.625rem", fontSize: "0.75rem", fontWeight: 500,
                        background: "var(--accent-subtle)", color: "var(--accent)",
                        borderRadius: "1rem", padding: "0.125rem 0.5rem",
                      }}>
                        {selectedEmployees.length} / {employees.length} selected
                      </span>
                    </h2>
                    <p style={{ fontSize: "0.8125rem", opacity: 0.55, margin: "0.125rem 0 0" }}>Select employees to include in this payrun</p>
                  </div>
                </div>
                <div style={{ position: "relative" }}>
                  <button
                    className="action-menu-btn"
                    type="button"
                    onClick={() => setOpenEmployeeBulkMenu((prev) => !prev)}
                    aria-label="Employee selection actions"
                  >
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="1.6" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                      <circle cx="12" cy="19" r="1.6" fill="currentColor" />
                    </svg>
                  </button>
                  {openEmployeeBulkMenu && (
                    <>
                      <button className="popover-backdrop" type="button" onClick={() => setOpenEmployeeBulkMenu(false)} />
                      <div className="action-popover">
                        <button className="action-popover-item" type="button" onClick={() => { setSelectedEmployees(employees.map((e) => e.id)); setOpenEmployeeBulkMenu(false); }}>
                          Include all employees
                        </button>
                        <button className="action-popover-item" type="button" onClick={() => { setSelectedEmployees([]); setOpenEmployeeBulkMenu(false); }}>
                          Clear selection
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {employees.length === 0 ? (
                <div className="empty-state" style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
                  <p style={{ marginBottom: "0.875rem", opacity: 0.6 }}>No employees found. Add employees first.</p>
                  <button type="button" className="btn btn-secondary" onClick={() => router.push("/pages/Employee")}>
                    Add Employees
                  </button>
                </div>
              ) : (
                <table className="data-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "left" }}>Employee</th>
                      <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "left" }}>Department</th>
                      <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "right" }}>Monthly Gross</th>
                      <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "right" }}>Est. Net Pay</th>
                      <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "center" }}>Status</th>
                      <th style={{ padding: "0.625rem 0.875rem", width: "3rem" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => {
                      const { net } = calculateNetPay(emp.grossSalary, deductions);
                      const isSelected = selectedEmployees.includes(emp.id);
                      return (
                        <tr key={emp.id} style={{ opacity: isSelected ? 1 : 0.4 }}>
                          <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem", fontWeight: 500 }}>{emp.name}</td>
                          <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem", opacity: 0.7 }}>{emp.department}</td>
                          <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem", textAlign: "right" }}>${emp.grossSalary.toLocaleString()}</td>
                          <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem", fontWeight: 600, textAlign: "right" }}>${net.toLocaleString()}</td>
                          <td style={{ padding: "0.75rem 0.875rem", textAlign: "center" }}>
                            <span style={{
                              display: "inline-block", fontSize: "0.7rem", fontWeight: 600,
                              padding: "0.2rem 0.6rem", borderRadius: "1rem",
                              background: isSelected ? "var(--success-subtle, #dcfce7)" : "var(--muted, #f3f4f6)",
                              color: isSelected ? "var(--success, #16a34a)" : "var(--muted-text, #9ca3af)",
                            }}>
                              {isSelected ? "Included" : "Excluded"}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 0.875rem" }} className="action-cell">
                            <button
                              className="action-menu-btn"
                              type="button"
                              onClick={() => setOpenEmployeeMenu((prev) => (prev === emp.id ? null : emp.id))}
                              aria-label="Employee selection"
                            >
                              <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="5" r="1.6" fill="currentColor" />
                                <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                                <circle cx="12" cy="19" r="1.6" fill="currentColor" />
                              </svg>
                            </button>
                            {openEmployeeMenu === emp.id && (
                              <>
                                <button className="popover-backdrop" type="button" onClick={() => setOpenEmployeeMenu(null)} />
                                <div className="action-popover">
                                  {isSelected ? (
                                    <button className="action-popover-item" type="button" onClick={() => { setSelectedEmployees(selectedEmployees.filter((id) => id !== emp.id)); setOpenEmployeeMenu(null); }}>
                                      Exclude from payrun
                                    </button>
                                  ) : (
                                    <button className="action-popover-item" type="button" onClick={() => { setSelectedEmployees([...selectedEmployees, emp.id]); setOpenEmployeeMenu(null); }}>
                                      Include in payrun
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Step 3: Deductions ── */}
            <div className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: "1.75rem", height: "1.75rem", borderRadius: "50%",
                    background: "var(--accent)", color: "#fff",
                    fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
                  }}>3</span>
                  <div>
                    <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Deductions &amp; Statutories</h2>
                    <p style={{ fontSize: "0.8125rem", opacity: 0.55, margin: "0.125rem 0 0" }}>Toggle applicable deductions for this payrun</p>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowStatutoryModal(true)}
                  style={{ fontSize: "0.8125rem", padding: "0.4rem 0.875rem" }}>
                  + Add Custom Statutory
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem" }}>
                {deductions.map((deduction, index) => (
                  <div
                    key={deduction.name}
                    className={`deduction-card ${deduction.applicable ? "active" : ""}`}
                    style={{
                      padding: "1.125rem 1.25rem",
                      borderRadius: "0.5rem",
                      border: `1.5px solid ${deduction.applicable ? "var(--accent)" : "var(--border, #e5e7eb)"}`,
                      background: deduction.applicable ? "var(--accent-subtle)" : "var(--surface, #f9fafb)",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
                      <span style={{
                        fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                        padding: "0.175rem 0.5rem", borderRadius: "0.25rem",
                        ...(deduction.type === "statutory" ? { background: "var(--accent-subtle)", color: "var(--accent)" } :
                           deduction.type === "tax"        ? { background: "rgba(234,179,8,0.12)", color: "#a16207" } :
                           deduction.type === "loan"       ? { background: "rgba(59,130,246,0.1)", color: "#1d4ed8" } :
                                                             { background: "var(--muted, #f3f4f6)", color: "var(--muted-text, #6b7280)" }),
                      }}>
                        {deduction.type}
                      </span>
                      <label className="toggle" style={{ margin: 0 }}>
                        <input type="checkbox" checked={deduction.applicable} onChange={() => toggleDeduction(index)} />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <h4 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.375rem" }}>{deduction.name}</h4>
                    {deduction.rate > 0 ? (
                      <p style={{ fontSize: "0.8125rem", opacity: 0.6, margin: 0 }}>{deduction.rate}% of gross salary</p>
                    ) : (
                      <div style={{ marginTop: "0.5rem" }}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: "0.25rem", opacity: 0.65 }}>Fixed Amount</label>
                        <input
                          type="number"
                          value={deduction.amount}
                          onChange={(e) => updateDeductionAmount(index, Number(e.target.value))}
                          disabled={!deduction.applicable}
                          style={{
                            width: "100%", padding: "0.45rem 0.625rem", fontSize: "0.875rem",
                            borderRadius: "0.35rem", border: "1px solid var(--border, #d1d5db)",
                            boxSizing: "border-box", background: "transparent",
                            opacity: deduction.applicable ? 1 : 0.5,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Payroll Summary Bar ── */}
            {selectedEmployees.length > 0 && period && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem",
                padding: "1rem 1.5rem", borderRadius: "0.5rem",
                background: "var(--accent-subtle)", border: "1px solid var(--accent-light)",
              }}>
                <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                  {[
                    { label: "Period", value: period || "—" },
                    { label: "Employees", value: selectedEmployees.length },
                    {
                      label: "Est. Gross",
                      value: "$" + employees
                        .filter(e => selectedEmployees.includes(e.id))
                        .reduce((s, e) => s + e.grossSalary, 0)
                        .toLocaleString(),
                    },
                    {
                      label: "Est. Net",
                      value: "$" + employees
                        .filter(e => selectedEmployees.includes(e.id))
                        .reduce((s, e) => s + calculateNetPay(e.grossSalary, deductions).net, 0)
                        .toLocaleString(),
                    },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6 }}>{item.label}</div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 700 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Form Actions ── */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.25rem", paddingBottom: "1rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveTab("overview")}
                style={{ padding: "0.625rem 1.25rem", fontSize: "0.875rem" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`btn btn-primary ${isProcessing ? "btn-loading" : ""}`}
                disabled={isProcessing || selectedEmployees.length === 0}
                style={{ padding: "0.625rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                {isProcessing && <span className="btn-spinner" />}
                {isProcessing ? "Processing..." : `Run Payroll — ${selectedEmployees.length} employee${selectedEmployees.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </form>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "history" && (
          <div className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>
            <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
              <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.2rem" }}>Payrun History</h2>
              <p style={{ fontSize: "0.8125rem", opacity: 0.55, margin: 0 }}>All processed payroll runs</p>
            </div>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  {["Run ID", "Period", "Payday", "Gross", "Deductions", "Net", "Employees", "Status", ""].map(h => (
                    <th key={h} style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payruns.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.8125rem", fontWeight: 600 }}>{row.id}</td>
                    <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem" }}>{row.period}</td>
                    <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem" }}>{row.payday}</td>
                    <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem" }}>${row.grossPay.toLocaleString()}</td>
                    <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem" }}>${row.deductions.toLocaleString()}</td>
                    <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem", fontWeight: 700 }}>${row.netPayroll.toLocaleString()}</td>
                    <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem" }}>{row.employees}</td>
                    <td style={{ padding: "0.75rem 0.875rem" }}>
                      <span className={`status-badge status-${row.status}`}>{row.status}</span>
                    </td>
                    <td style={{ padding: "0.75rem 0.875rem" }} className="action-cell">
                      <button
                        className="action-menu-btn"
                        type="button"
                        onClick={() => setOpenPayrunMenu((prev) => (prev === row.id ? null : row.id))}
                        aria-label="Payrun actions"
                      >
                        <svg viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.6" fill="currentColor" />
                          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                          <circle cx="12" cy="19" r="1.6" fill="currentColor" />
                        </svg>
                      </button>
                      {openPayrunMenu === row.id && (
                        <>
                          <button className="popover-backdrop" type="button" onClick={() => setOpenPayrunMenu(null)} />
                          <div className="action-popover">
                            <button className="action-popover-item" type="button">View details</button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Custom Statutory Modal ── */}
        {showStatutoryModal && (
          <div className="modal-backdrop" onClick={() => setShowStatutoryModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "2rem", maxWidth: "480px", width: "100%", borderRadius: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Request Custom Statutory</h3>
                <button className="modal-close" onClick={() => setShowStatutoryModal(false)} type="button">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <p style={{ fontSize: "0.875rem", opacity: 0.6, marginBottom: "1.25rem" }}>
                Send a request to the system admin to enable custom statutory deductions for your organization.
              </p>
              <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                <label htmlFor="statutoryNote" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.4rem" }}>
                  Request Details
                </label>
                <textarea
                  id="statutoryNote"
                  rows={5}
                  value={statutoryNote}
                  onChange={(e) => setStatutoryNote(e.target.value)}
                  placeholder="Describe the statutory item and the business reason..."
                  style={{ width: "100%", padding: "0.625rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>
              {statutoryStatus && (
                <div className="status-pill status-pill-success" style={{ marginBottom: "1rem", fontSize: "0.8125rem" }}>
                  {statutoryStatus}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button className="btn btn-secondary" type="button" onClick={() => setShowStatutoryModal(false)}
                  style={{ padding: "0.6rem 1.125rem", fontSize: "0.875rem" }}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="button" onClick={submitStatutoryRequest}
                  style={{ padding: "0.6rem 1.125rem", fontSize: "0.875rem" }}>
                  Send Request
                </button>
              </div>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}