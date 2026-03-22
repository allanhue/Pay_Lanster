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

    // Load employees for payroll
    if (current.orgId) {
      api.listEmployees(current.orgId)
        .then((data) => {
          const payrollEmployees = (Array.isArray(data) ? data : []).map((emp: any) => ({
            id: emp.id,
            name: emp.fullName,
            department: emp.department,
            grossSalary: emp.salary / 12, // Monthly
            deductions: defaultDeductions.map(d => ({ ...d })),
            netPay: 0,
          }));
          setEmployees(payrollEmployees);
          setSelectedEmployees(payrollEmployees.map(e => e.id));
        })
        .catch(() => {
          setEmployees([]);
        });

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
        if (d.rate > 0) {
          totalDeductions += (gross * d.rate) / 100;
        } else if (d.amount > 0) {
          totalDeductions += d.amount;
        }
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
      <section className="content">
        <div className="page-header">
          <div className="page-header-content">
            <h1>Payroll Center</h1>
            <p>Manage payroll runs, process payments, and review payrun history.</p>
          </div>
          <ModuleActions />
        </div>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {/* Tab Navigation */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Overview
          </button>
          <button
            className={`tab ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Run Payroll
          </button>
          <button
            className={`tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8v4l3 3M3 12a9 9 0 1018 0 9 9 0 00-18 0z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            History
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            <div className="cards-grid four-col">
              <div className="card card-metric">
                <span className="metric-label">Upcoming Payrun</span>
                <strong className="metric-value">{totals.upcoming?.period || "None scheduled"}</strong>
                <span className="metric-sublabel">{totals.upcoming?.payday || "-"}</span>
              </div>
              <div className="card card-metric">
                <span className="metric-label">Total Employees</span>
                <strong className="metric-value">{employees.length}</strong>
                <span className="metric-sublabel">Active for payroll</span>
              </div>
              <div className="card card-metric">
                <span className="metric-label">Total Gross</span>
                <strong className="metric-value">${totals.totalGross.toLocaleString()}</strong>
                <span className="metric-sublabel">YTD processed</span>
              </div>
              <div className="card card-metric">
                <span className="metric-label">Completed Runs</span>
                <strong className="metric-value">{totals.completed}</strong>
                <span className="metric-sublabel">This year</span>
              </div>
            </div>

            <div className="panel panel-elevated">
              <div className="panel-header">
                <h2>Quick Actions</h2>
              </div>
              <div className="action-grid">
                <button 
                  className="action-card" 
                  onClick={() => setActiveTab("create")}
                >
                  <span className="action-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{width: "2rem", height: "2rem"}}>
                      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="action-title">Run New Payroll</span>
                  <span className="action-desc">Process monthly or biweekly payroll</span>
                </button>
                <button className="action-card" onClick={() => router.push("/pages/Payslips")}>
                  <span className="action-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{width: "2rem", height: "2rem"}}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <polyline points="14,2 14,8 20,8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" />
                      <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" />
                      <polyline points="10,9 9,9 8,9" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                  <span className="action-title">Generate Payslips</span>
                  <span className="action-desc">Bulk generate employee payslips</span>
                </button>
                <button className="action-card" onClick={() => router.push("/pages/Reports")}>
                  <span className="action-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{width: "2rem", height: "2rem"}}>
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

        {/* Create Payroll Tab */}
        {activeTab === "create" && (
          <form onSubmit={handleRunPayroll} className="payrun-form">
            <div className="panel panel-elevated">
              <div className="panel-header">
                <h2>Payroll Details</h2>
                <p>Configure the payrun period and payment date</p>
              </div>
              <div className="form-grid form-two-col">
                <div className="form-group">
                  <label htmlFor="period">Pay Period</label>
                  <input
                    id="period"
                    type="text"
                    placeholder="e.g., May 2026"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="payDate">Payment Date</label>
                  <input
                    id="payDate"
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="panel panel-elevated">
              <div className="panel-header">
                <h2>Employees</h2>
                <p>Select employees to include in this payrun</p>
                <div className="panel-meta">
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
                        <button
                          className="action-popover-item"
                          type="button"
                          onClick={() => {
                            setSelectedEmployees(employees.map((e) => e.id));
                            setOpenEmployeeBulkMenu(false);
                          }}
                        >
                          Include all employees
                        </button>
                        <button
                          className="action-popover-item"
                          type="button"
                          onClick={() => {
                            setSelectedEmployees([]);
                            setOpenEmployeeBulkMenu(false);
                          }}
                        >
                          Clear selection
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {employees.length === 0 ? (
                <div className="empty-state">
                  <p>No employees found. Add employees first.</p>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => router.push("/pages/Employee")}
                  >
                    Add Employees
                  </button>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Monthly Gross</th>
                      <th>Est. Net Pay</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => {
                      const { net } = calculateNetPay(emp.grossSalary, deductions);
                      return (
                        <tr key={emp.id}>
                          <td>{emp.name}</td>
                          <td>{emp.department}</td>
                          <td>${emp.grossSalary.toLocaleString()}</td>
                          <td>${net.toLocaleString()}</td>
                          <td className="action-cell">
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
                                  {selectedEmployees.includes(emp.id) ? (
                                    <button
                                      className="action-popover-item"
                                      type="button"
                                      onClick={() => {
                                        setSelectedEmployees(selectedEmployees.filter((id) => id !== emp.id));
                                        setOpenEmployeeMenu(null);
                                      }}
                                    >
                                      Exclude from payrun
                                    </button>
                                  ) : (
                                    <button
                                      className="action-popover-item"
                                      type="button"
                                      onClick={() => {
                                        setSelectedEmployees([...selectedEmployees, emp.id]);
                                        setOpenEmployeeMenu(null);
                                      }}
                                    >
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

            <div className="panel panel-elevated">
              <div className="panel-header">
                <h2>Deductions & Statutories</h2>
                <p>Configure applicable deductions for this payrun</p>
                <div className="panel-meta">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowStatutoryModal(true)}>
                    Add Custom Statutory
                  </button>
                </div>
              </div>
              <div className="deductions-grid">
                {deductions.map((deduction, index) => (
                  <div key={deduction.name} className={`deduction-card ${deduction.applicable ? "active" : ""}`}>
                    <div className="deduction-header">
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={deduction.applicable}
                          onChange={() => toggleDeduction(index)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                      <span className={`deduction-type type-${deduction.type}`}>{deduction.type}</span>
                    </div>
                    <h4>{deduction.name}</h4>
                    {deduction.rate > 0 ? (
                      <p className="deduction-rate">{deduction.rate}% of gross</p>
                    ) : (
                      <div className="form-group">
                        <label>Fixed Amount</label>
                        <input
                          type="number"
                          value={deduction.amount}
                          onChange={(e) => updateDeductionAmount(index, Number(e.target.value))}
                          disabled={!deduction.applicable}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveTab("overview")}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`btn btn-primary ${isProcessing ? "btn-loading" : ""}`}
                disabled={isProcessing || selectedEmployees.length === 0}
              >
                {isProcessing && <span className="btn-spinner" />}
                {isProcessing ? "Processing..." : `Run Payroll (${selectedEmployees.length} employees)`}
              </button>
            </div>
          </form>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="panel panel-elevated">
            <div className="panel-header">
              <h2>Payrun History</h2>
              <p>All processed payroll runs</p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Period</th>
                  <th>Payday</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net</th>
                  <th>Employees</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payruns.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.id}</strong></td>
                    <td>{row.period}</td>
                    <td>{row.payday}</td>
                    <td>${row.grossPay.toLocaleString()}</td>
                    <td>${row.deductions.toLocaleString()}</td>
                    <td><strong>${row.netPayroll.toLocaleString()}</strong></td>
                    <td>{row.employees}</td>
                    <td>
                      <span className={`status-badge status-${row.status}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-cell">
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
                              <button className="action-popover-item" type="button">
                                View details
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showStatutoryModal && (
          <div className="modal-backdrop" onClick={() => setShowStatutoryModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Request Custom Statutory</h3>
                <button className="modal-close" onClick={() => setShowStatutoryModal(false)} type="button">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <p className="muted-text">
                  Send a request to the system admin to enable custom statutory deductions for your organization.
                </p>
                <div className="form-group">
                  <label htmlFor="statutoryNote">Request Details</label>
                  <textarea
                    id="statutoryNote"
                    rows={5}
                    value={statutoryNote}
                    onChange={(e) => setStatutoryNote(e.target.value)}
                    placeholder="Describe the statutory item and the business reason..."
                  />
                </div>
                {statutoryStatus && <div className="status-pill status-pill-success">{statutoryStatus}</div>}
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setShowStatutoryModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="button" onClick={submitStatutoryRequest}>
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
