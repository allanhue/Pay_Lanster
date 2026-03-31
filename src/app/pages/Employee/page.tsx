"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import ModuleActions from "@/app/components/ModuleActions";
import { api, type PayrollEmployee } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

export default function EmployeePage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [position, setPosition] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [salary, setSalary] = useState("");
  const [payCycle, setPayCycle] = useState<"monthly" | "biweekly">("monthly");
  const [status, setStatus] = useState<"active" | "on_leave" | "terminated">("active");
  const [contractType, setContractType] = useState("full_time");
  const [taxId, setTaxId] = useState("");
  const [nssf, setNssf] = useState("");
  const [nhif, setNhif] = useState("");
  const [paye, setPaye] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [location, setLocation] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importError, setImportError] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollEmployee | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<PayrollEmployee | null>(null);
  const [actionEmployee, setActionEmployee] = useState<PayrollEmployee | null>(null);
  const [confirmDeleteEmployee, setConfirmDeleteEmployee] = useState<PayrollEmployee | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterPayCycle, setFilterPayCycle] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const router = useRouter();

  const refresh = async (orgId: string) => {
    const list = await api.listEmployees(orgId);
    setEmployees(Array.isArray(list) ? list : []);
  };

  useEffect(() => {
    const current = readSession();
    if (!current) { router.replace("/auth/login"); return; }
    if (current.role !== "org_admin" || !current.orgId) { router.replace("/system_admin/Dasboard"); return; }
    setSession(current);
    void refresh(current.orgId).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load employees");
    });
  }, [router]);

  const resetForm = () => {
    setFullName(""); setEmail(""); setPhone(""); setTitle(""); setPosition("");
    setDesignation(""); setDepartment(""); setSalary(""); setPayCycle("monthly");
    setStatus("active"); setContractType("full_time"); setTaxId(""); setNssf("");
    setNhif(""); setPaye(""); setBankName(""); setBankAccountName("");
    setBankAccount(""); setLocation(""); setHireDate("");
  };

  const openAddForm = () => { setEditingEmployee(null); resetForm(); setShowForm(true); };

  const normalizeHeader = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");

  const parseCSV = (input: string) => {
    const rows: string[][] = [];
    let current = "";
    let inQuotes = false;
    const pushCell = (row: string[]) => {
      row.push(current.trim());
      current = "";
    };
    const pushRow = (row: string[]) => {
      if (row.length > 0 && row.some((cell) => cell !== "")) {
        rows.push(row);
      }
    };
    let row: string[] = [];
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const next = input[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === "," && !inQuotes) {
        pushCell(row);
        continue;
      }
      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i++;
        pushCell(row);
        pushRow(row);
        row = [];
        continue;
      }
      current += char;
    }
    if (current.length > 0 || row.length > 0) {
      pushCell(row);
      pushRow(row);
    }
    return rows;
  };

  const handleImport = async () => {
    if (!importFile || !session?.orgId) return;
    setImportError("");
    setImportStatus("");
    setImporting(true);
    try {
      const raw = await importFile.text();
      const rows = parseCSV(raw);
      if (rows.length < 2) {
        setImportError("CSV looks empty. Please include a header row and at least one employee.");
        return;
      }
      const header = rows[0].map(normalizeHeader);
      const headerMap: Record<string, string> = {
        fullname: "fullName",
        email: "email",
        department: "department",
        salary: "salary",
        paycycle: "payCycle",
        phone: "phone",
        title: "title",
        position: "position",
        designation: "designation",
        status: "status",
        contracttype: "contractType",
        taxid: "taxId",
        nssf: "nssf",
        nhif: "nhif",
        paye: "paye",
        bankname: "bankName",
        bankaccountname: "bankAccountName",
        bankaccount: "bankAccount",
        location: "location",
        hiredate: "hireDate",
      };
      const indexByKey: Record<string, number> = {};
      header.forEach((key, idx) => {
        const mapped = headerMap[key];
        if (mapped) indexByKey[mapped] = idx;
      });
      const required = ["fullName", "email", "department", "salary", "payCycle"];
      const missing = required.filter((key) => indexByKey[key] === undefined);
      if (missing.length > 0) {
        setImportError(`Missing required columns: ${missing.join(", ")}`);
        return;
      }

      let success = 0;
      let failed = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const get = (key: string) => row[indexByKey[key]] || "";
        const salaryValue = Number(get("salary"));
        if (!get("fullName") || !get("email") || !get("department") || Number.isNaN(salaryValue)) {
          failed++;
          continue;
        }
        const payCycleRaw = (get("payCycle") || "monthly").toLowerCase();
        const payCycleValue = payCycleRaw === "biweekly" ? "biweekly" : "monthly";
        await api.addEmployee({
          orgId: session.orgId,
          fullName: get("fullName"),
          email: get("email"),
          department: get("department"),
          salary: salaryValue,
          payCycle: payCycleValue,
          phone: get("phone"),
          title: get("title"),
          position: get("position"),
          designation: get("designation"),
          status: (get("status") || "active") as PayrollEmployee["status"],
          contractType: get("contractType") || "full_time",
          taxId: get("taxId"),
          nssf: get("nssf"),
          nhif: get("nhif"),
          paye: get("paye"),
          bankName: get("bankName"),
          bankAccountName: get("bankAccountName"),
          bankAccount: get("bankAccount"),
          location: get("location"),
          hireDate: get("hireDate"),
        });
        success++;
      }
      await refresh(session.orgId);
      setImportStatus(`Imported ${success} employees. ${failed > 0 ? `${failed} failed.` : ""}`);
      setImportFile(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import CSV.");
    } finally {
      setImporting(false);
    }
  };

  const openEditForm = (employee: PayrollEmployee) => {
    setEditingEmployee(employee);
    setFullName(employee.fullName); setEmail(employee.email); setPhone(employee.phone || "");
    setTitle(employee.title || ""); setPosition(employee.position || "");
    setDesignation(employee.designation || ""); setDepartment(employee.department);
    setSalary(String(employee.salary)); setPayCycle(employee.payCycle);
    setStatus(employee.status); setContractType(employee.contractType || "full_time");
    setTaxId(employee.taxId || ""); setNssf(employee.nssf || ""); setNhif(employee.nhif || "");
    setPaye(employee.paye || ""); setBankName(employee.bankName || "");
    setBankAccountName(employee.bankAccountName || ""); setBankAccount(employee.bankAccount || "");
    setLocation(employee.location || ""); setHireDate(employee.hireDate || "");
    setShowForm(true);
  };

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.orgId) return;
    setError(""); setSaving(true);
    try {
      if (editingEmployee) {
        await api.updateEmployee({ id: editingEmployee.id, orgId: session.orgId, fullName, email, phone, title, position, designation, department, salary: Number(salary), payCycle, status, contractType, taxId, nssf, nhif, paye, bankName, bankAccountName, bankAccount, location, hireDate });
      } else {
        await api.addEmployee({ orgId: session.orgId, fullName, email, phone, title, position, designation, department, salary: Number(salary), payCycle, status, contractType, taxId, nssf, nhif, paye, bankName, bankAccountName, bankAccount, location, hireDate });
      }
      resetForm(); setEditingEmployee(null); setShowForm(false);
      await refresh(session.orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save employee");
    } finally {
      setSaving(false);
    }
  };

  const departments = useMemo(() => {
    const depts = [...new Set(employees.map((emp) => emp.department).filter(Boolean))];
    return depts.sort();
  }, [employees]);

  const activeEmployees = useMemo(() => employees.filter((emp) => emp.status === "active").length, [employees]);
  const onLeaveEmployees = useMemo(() => employees.filter((emp) => emp.status === "on_leave").length, [employees]);
  const terminatedEmployees = useMemo(() => employees.filter((emp) => emp.status === "terminated").length, [employees]);
  const monthlyPayroll = useMemo(() => employees.filter((emp) => emp.payCycle === "monthly" && emp.status === "active").reduce((sum, emp) => sum + emp.salary, 0), [employees]);

  const filteredAndSortedEmployees = useMemo(() => {
    let filtered = employees.filter(employee => {
      const matchesSearch = searchQuery === "" ||
        employee.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch &&
        (filterDepartment === "all" || employee.department === filterDepartment) &&
        (filterPayCycle === "all" || employee.payCycle === filterPayCycle) &&
        (filterStatus === "all" || employee.status === filterStatus);
    });
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortBy) {
        case "name": aValue = a.fullName.toLowerCase(); bValue = b.fullName.toLowerCase(); break;
        case "email": aValue = a.email.toLowerCase(); bValue = b.email.toLowerCase(); break;
        case "department": aValue = a.department.toLowerCase(); bValue = b.department.toLowerCase(); break;
        case "salary": aValue = a.salary; bValue = b.salary; break;
        case "payCycle": aValue = a.payCycle; bValue = b.payCycle; break;
        default: aValue = a.fullName.toLowerCase(); bValue = b.fullName.toLowerCase();
      }
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [employees, searchQuery, filterDepartment, filterPayCycle, filterStatus, sortBy, sortOrder]);

  const handleSort = (column: string) => {
    if (sortBy === column) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(column); setSortOrder("asc"); }
  };

  const onDeleteEmployee = async (employee: PayrollEmployee) => {
    if (!session?.orgId) return;
    setDeleting(employee.id);
    try {
      await api.deleteEmployee(session.orgId, employee.id);
      setEmployees((prev) => prev.filter((item) => item.id !== employee.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete employee");
    } finally {
      setDeleting(null);
    }
  };

  const clearFilters = () => { setSearchQuery(""); setFilterDepartment("all"); setFilterPayCycle("all"); setFilterStatus("all"); };
  const hasActiveFilters = searchQuery || filterDepartment !== "all" || filterPayCycle !== "all" || filterStatus !== "all";

  if (!session) return <main className="centered">Loading...</main>;

  // ── Section label component for form
  const SectionLabel = ({ step, title, subtitle }: { step: number; title: string; subtitle: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: "1.5rem", height: "1.5rem", borderRadius: "50%",
        background: "var(--accent)", color: "#fff",
        fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
      }}>{step}</span>
      <div>
        <div style={{ fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.1rem" }}>{subtitle}</div>
      </div>
    </div>
  );

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide employee-page">

        {/* ── Page Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
          <div className="page-header-content">
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Employees</h1>
            <p style={{ fontSize: "0.875rem", opacity: 0.6, margin: 0 }}>Manage your team and payroll information</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <ModuleActions />
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowImport(true)}>
              Import
            </button>
            <button className="btn btn-primary btn-sm" type="button" onClick={openAddForm}>
              + Add Employee
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>{error}</div>}

        {/* ── Metric Cards ── */}
        <div className="cards-grid four-col" style={{ gap: "1.25rem", marginBottom: "1.75rem" }}>
          <article className="card card-metric" style={{ padding: "1.25rem 1.5rem" }}>
            <span className="metric-label">Active</span>
            <strong className="metric-value">{activeEmployees}</strong>
            <span className="metric-sublabel">Currently employed</span>
          </article>
          <article className="card card-metric" style={{ padding: "1.25rem 1.5rem" }}>
            <span className="metric-label">On Leave</span>
            <strong className="metric-value">{onLeaveEmployees}</strong>
            <span className="metric-sublabel">Temporarily inactive</span>
          </article>
          <article className="card card-metric" style={{ padding: "1.25rem 1.5rem" }}>
            <span className="metric-label">Terminated</span>
            <strong className="metric-value">{terminatedEmployees}</strong>
            <span className="metric-sublabel">Archived records</span>
          </article>
          <article className="card card-metric" style={{ padding: "1.25rem 1.5rem" }}>
            <span className="metric-label">Monthly Payroll</span>
            <strong className="metric-value">${monthlyPayroll.toLocaleString()}</strong>
            <span className="metric-sublabel">Active employees</span>
          </article>
        </div>

        {/* ── Employee List Panel ── */}
        <article className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>

          {/* Panel header + search row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.2rem" }}>Employee List</h2>
              <p style={{ fontSize: "0.8125rem", opacity: 0.55, margin: 0 }}>
                {filteredAndSortedEmployees.length} of {employees.length} employee{employees.length !== 1 ? "s" : ""}
                {hasActiveFilters && " — filtered"}
              </p>
            </div>

            {/* Search */}
            <div style={{ position: "relative", minWidth: "240px" }}>
              <svg viewBox="0 0 24 24" style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", width: "0.9rem", height: "0.9rem", opacity: 0.4, pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M21 21l-4.35-4.35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search name, email, department…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "2rem", paddingRight: "0.875rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontSize: "0.8125rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", width: "100%", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* Filter row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              style={{ fontSize: "0.8125rem", padding: "0.45rem 0.75rem", borderRadius: "0.35rem", border: "1px solid var(--border, #d1d5db)", background: "var(--surface, #fff)" }}
            >
              <option value="all">All Departments</option>
              {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
            </select>

            <select
              value={filterPayCycle}
              onChange={(e) => setFilterPayCycle(e.target.value)}
              style={{ fontSize: "0.8125rem", padding: "0.45rem 0.75rem", borderRadius: "0.35rem", border: "1px solid var(--border, #d1d5db)", background: "var(--surface, #fff)" }}
            >
              <option value="all">All Pay Cycles</option>
              <option value="monthly">Monthly</option>
              <option value="biweekly">Biweekly</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ fontSize: "0.8125rem", padding: "0.45rem 0.75rem", borderRadius: "0.35rem", border: "1px solid var(--border, #d1d5db)", background: "var(--surface, #fff)" }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="terminated">Terminated</option>
            </select>

            {hasActiveFilters && (
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={clearFilters}
                style={{ fontSize: "0.8125rem", padding: "0.45rem 0.75rem" }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Table or empty state */}
          {filteredAndSortedEmployees.length === 0 ? (
            <div className="empty-state" style={{ padding: "3rem 1rem", textAlign: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "2.5rem", height: "2.5rem", opacity: 0.25, margin: "0 auto 0.75rem", display: "block" }}>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <p style={{ opacity: 0.55, marginBottom: "0.875rem", fontSize: "0.875rem" }}>No employees match your filters.</p>
              <button className="btn btn-secondary btn-sm" type="button" onClick={clearFilters}>Clear Filters</button>
            </div>
          ) : (
            <div className="table-container employee-table-wrap">
              <table className="data-table employee-table-compact" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    {[
                      { key: "name", label: "Employee" },
                      { key: "email", label: "Email" },
                      { key: "department", label: "Department" },
                      { key: "payCycle", label: "Pay Cycle" },
                      { key: "salary", label: "Annual Salary" },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "left", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                      >
                        {col.label}
                        {sortBy === col.key && (
                          <span style={{ marginLeft: "0.25rem", opacity: 0.8 }}>{sortOrder === "asc" ? "↑" : "↓"}</span>
                        )}
                      </th>
                    ))}
                    <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "right" }}>Monthly Pay</th>
                    <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55 }}>Status</th>
                    <th style={{ padding: "0.625rem 0.875rem", width: "2.5rem" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="clickable-row"
                      onClick={() => { setSelectedEmployee(employee); setShowDetails(true); }}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ padding: "0.75rem 0.875rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                          <span className="employee-name" style={{ fontSize: "0.875rem", fontWeight: 600 }}>{employee.fullName}</span>
                          <span className="employee-id" style={{ fontSize: "0.75rem", opacity: 0.45, fontFamily: "monospace" }}>{employee.id}</span>
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 0.875rem" }}>
                        <a
                          href={`mailto:${employee.email}`}
                          className="employee-email"
                          style={{ fontSize: "0.8125rem", color: "var(--accent)", textDecoration: "none" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {employee.email}
                        </a>
                      </td>
                      <td style={{ padding: "0.75rem 0.875rem" }}>
                        <span className="department-badge" style={{ fontSize: "0.75rem" }}>{employee.department}</span>
                      </td>
                      <td style={{ padding: "0.75rem 0.875rem" }}>
                        <span className={`paycycle-badge ${employee.payCycle}`} style={{ fontSize: "0.75rem" }}>
                          {employee.payCycle === "monthly" ? "Monthly" : "Biweekly"}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem", fontWeight: 500 }}>
                        ${employee.salary.toLocaleString()}
                      </td>
                      <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.875rem", fontWeight: 600, textAlign: "right" }}>
                        ${employee.payCycle === "monthly"
                          ? employee.salary.toLocaleString()
                          : Math.round(employee.salary / 26).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.75rem 0.875rem" }}>
                        <span className={`status-badge status-${employee.status}`}>
                          {employee.status.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.875rem" }} className="action-cell">
                        <button
                          className="action-menu-btn"
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setActionEmployee(employee); }}
                        >
                          <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="1.6" fill="currentColor" />
                            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                            <circle cx="12" cy="19" r="1.6" fill="currentColor" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>


        {/* ── Add / Edit Employee Modal ── */}
        {showForm && (
          <div className="modal-backdrop" onClick={() => { setShowForm(false); setEditingEmployee(null); }}>
            <div
              className="modal-content modal-large employee-modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "640px", width: "100%", borderRadius: "0.75rem", overflow: "hidden" }}
            >
              {/* Modal header */}
              <div className="modal-header" style={{ padding: "1.25rem 1.75rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.2rem" }}>
                    {editingEmployee ? "Edit Employee" : "Add New Employee"}
                  </h3>
                  <p style={{ fontSize: "0.8125rem", opacity: 0.5, margin: 0 }}>
                    {editingEmployee ? `Editing ${editingEmployee.fullName}` : "Fill in the employee's details below"}
                  </p>
                </div>
                <button className="modal-close" onClick={() => { setShowForm(false); setEditingEmployee(null); }} type="button">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Scrollable form body */}
              <div className="modal-body" style={{ padding: "1.5rem 1.75rem", overflowY: "auto", maxHeight: "72vh" }}>
                <form className="employee-form" onSubmit={onAdd} style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>

                  {/* Section 1: Personal Info */}
                  <div>
                    <SectionLabel step={1} title="Personal Information" subtitle="Name, contact details and location" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                          Full Name <span style={{ color: "var(--error, #ef4444)" }}>*</span>
                        </label>
                        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g., Jane Adams" required
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                          Email <span style={{ color: "var(--error, #ef4444)" }}>*</span>
                        </label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Phone</label>
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254…"
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Location</label>
                        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Nairobi"
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Role & Employment */}
                  <div>
                    <SectionLabel step={2} title="Role & Employment" subtitle="Department, position, contract type and hire date" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                          Department <span style={{ color: "var(--error, #ef4444)" }}>*</span>
                        </label>
                        <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g., Operations" required
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Title</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Senior Analyst"
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Position</label>
                        <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g., Payroll Specialist"
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Designation</label>
                        <input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g., Grade 5"
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Contract Type</label>
                        <select value={contractType} onChange={(e) => setContractType(e.target.value)}
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box", background: "var(--surface, #fff)" }}>
                          <option value="full_time">Full Time</option>
                          <option value="part_time">Part Time</option>
                          <option value="contract">Contract</option>
                          <option value="intern">Intern</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box", background: "var(--surface, #fff)" }}>
                          <option value="active">Active</option>
                          <option value="on_leave">On Leave</option>
                          <option value="terminated">Terminated</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Hire Date</label>
                        <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)}
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Payroll */}
                  <div>
                    <SectionLabel step={3} title="Payroll" subtitle="Salary and pay cycle" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                          Annual Salary <span style={{ color: "var(--error, #ef4444)" }}>*</span>
                        </label>
                        <input type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="0" required
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Pay Cycle</label>
                        <select value={payCycle} onChange={(e) => setPayCycle(e.target.value as typeof payCycle)}
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box", background: "var(--surface, #fff)" }}>
                          <option value="monthly">Monthly</option>
                          <option value="biweekly">Biweekly</option>
                        </select>
                      </div>
                    </div>
                    {/* Derived pay preview */}
                    {salary && Number(salary) > 0 && (
                      <div style={{ marginTop: "0.875rem", padding: "0.75rem 1rem", borderRadius: "0.4rem", background: "var(--accent-subtle)", border: "1px solid var(--accent-light)", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6 }}>Monthly Gross</div>
                          <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>${Math.round(Number(salary) / 12).toLocaleString()}</div>
                        </div>
                        {payCycle === "biweekly" && (
                          <div>
                            <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6 }}>Per Pay Period</div>
                            <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>${Math.round(Number(salary) / 26).toLocaleString()}</div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6 }}>Annual</div>
                          <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>${Number(salary).toLocaleString()}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 4: Banking */}
                  <div>
                    <SectionLabel step={4} title="Banking Details" subtitle="Bank account for salary disbursement" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Bank Name</label>
                        <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g., KCB"
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Account Name</label>
                        <input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Account holder name"
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0, gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Account Number</label>
                        <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="Account number"
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                    </div>
                  </div>

                  {/* Section 5: Compliance / Tax */}
                  <div>
                    <SectionLabel step={5} title="Tax & Compliance" subtitle="KRA PIN, NSSF, NHIF and PAYE references" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Tax ID (KRA PIN)</label>
                        <input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="KRA PIN"
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>NSSF No.</label>
                        <input value={nssf} onChange={(e) => setNssf(e.target.value)}
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>NHIF No.</label>
                        <input value={nhif} onChange={(e) => setNhif(e.target.value)}
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>PAYE Ref.</label>
                        <input value={paye} onChange={(e) => setPaye(e.target.value)}
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                    </div>
                  </div>

                  {/* Form actions — sticky inside scroll */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <button className="btn btn-secondary" type="button" style={{ padding: "0.625rem 1.25rem", fontSize: "0.875rem" }}
                      onClick={() => { setShowForm(false); setEditingEmployee(null); }}>
                      Cancel
                    </button>
                    <button className={`btn btn-primary ${saving ? "btn-loading" : ""}`} type="submit" disabled={saving}
                      style={{ padding: "0.625rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {saving && <span className="btn-spinner" />}
                      {saving ? "Saving…" : editingEmployee ? "Save Changes" : "Add Employee"}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          </div>
        )}


        {/* ── Employee Actions modal ── */}
        {actionEmployee && (
          <div className="modal-backdrop" onClick={() => setActionEmployee(null)}>
            <div className="modal-content modal-mini" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header" style={{ padding: "1rem 1.25rem" }}>
                <div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.1rem" }}>{actionEmployee.fullName}</h3>
                  <p style={{ fontSize: "0.75rem", opacity: 0.5, margin: 0 }}>{actionEmployee.department}</p>
                </div>
                <button className="modal-close" onClick={() => setActionEmployee(null)} type="button">
                  <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <div className="modal-body" style={{ padding: "0.5rem 0.75rem 1rem" }}>
                <div className="action-menu">
                  <button className="action-menu-item" type="button" onClick={() => { setSelectedEmployee(actionEmployee); setShowDetails(true); setActionEmployee(null); }}>
                    View details
                  </button>
                  <button className="action-menu-item" type="button" onClick={() => { openEditForm(actionEmployee); setActionEmployee(null); }}>
                    Edit employee
                  </button>
                  <button className="action-menu-item danger" type="button" onClick={() => { setConfirmDeleteEmployee(actionEmployee); setActionEmployee(null); }}>
                    Delete employee
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirm Delete modal ── */}
        {confirmDeleteEmployee && (
          <div className="modal-backdrop" onClick={() => setConfirmDeleteEmployee(null)}>
            <div className="modal-content modal-mini" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header" style={{ padding: "1.25rem 1.5rem" }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0 }}>Delete Employee</h3>
                <button className="modal-close" onClick={() => setConfirmDeleteEmployee(null)} type="button">
                  <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <div className="modal-body" style={{ padding: "0.5rem 1.5rem 1.25rem" }}>
                <p style={{ fontSize: "0.875rem", opacity: 0.7, margin: "0 0 1.25rem" }}>
                  Are you sure you want to delete <strong>{confirmDeleteEmployee.fullName}</strong>? This action cannot be undone.
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
                  <button className="btn btn-secondary" type="button" style={{ fontSize: "0.875rem" }} onClick={() => setConfirmDeleteEmployee(null)}>Cancel</button>
                  <button className="danger btn" type="button" style={{ fontSize: "0.875rem" }}
                    onClick={() => { onDeleteEmployee(confirmDeleteEmployee); setConfirmDeleteEmployee(null); }}
                    disabled={deleting === confirmDeleteEmployee.id}>
                    {deleting === confirmDeleteEmployee.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Import modal ── */}
        {showImport && (
          <div className="modal-backdrop" onClick={() => setShowImport(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px", borderRadius: "0.75rem" }}>
              <div className="modal-header" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.15rem" }}>Import Employees</h3>
                  <p style={{ fontSize: "0.8125rem", opacity: 0.5, margin: 0 }}>Upload a CSV to bulk-add employees</p>
                </div>
                <button className="modal-close" onClick={() => setShowImport(false)} type="button">
                  <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <div className="modal-body" style={{ padding: "1.25rem 1.5rem" }}>
                <p style={{ fontSize: "0.8125rem", opacity: 0.6, marginBottom: "1rem" }}>
                  CSV must include columns: <code>fullName, email, department, salary, payCycle</code>
                </p>
                <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>CSV File</label>
                  <input
                    id="employeeImport"
                    type="file"
                    accept=".csv"
                    onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportError(""); setImportStatus(""); }}
                    style={{ width: "100%", fontSize: "0.875rem" }}
                  />
                </div>
                {importError && (
                  <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>
                    {importError}
                  </div>
                )}
                {importStatus && (
                  <div className="alert alert-success" style={{ marginBottom: "0.75rem" }}>
                    {importStatus}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
                  <button className="btn btn-secondary" type="button" style={{ fontSize: "0.875rem" }} onClick={() => setShowImport(false)}>Cancel</button>
                  <button
                    className={`btn btn-primary${importing ? " btn-loading" : ""}`}
                    type="button"
                    style={{ fontSize: "0.875rem" }}
                    disabled={importing || !importFile}
                    onClick={handleImport}
                  >
                    {importing && <span className="btn-spinner" />}
                    {importing ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Detail Drawer ── */}
        {showDetails && selectedEmployee && (
          <>
            <button className="detail-drawer-backdrop" type="button" onClick={() => setShowDetails(false)} aria-label="Close details" />
            <aside className="detail-drawer" aria-label="Employee details">
              {/* Drawer header */}
              <div className="detail-drawer-header" style={{ padding: "1.5rem 1.5rem 1.25rem" }}>
                <div className="detail-avatar" style={{ flexShrink: 0 }}>
                  {selectedEmployee.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                </div>
                <div className="detail-header-text" style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.15rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedEmployee.fullName}</h3>
                  <span className="detail-id" style={{ fontSize: "0.7rem", opacity: 0.45, fontFamily: "monospace" }}>{selectedEmployee.id}</span>
                  <span className="detail-sub" style={{ display: "block", fontSize: "0.8rem", opacity: 0.6, marginTop: "0.1rem" }}>
                    {[selectedEmployee.title, selectedEmployee.department].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <button className="detail-close" type="button" onClick={() => setShowDetails(false)}>
                  <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>

              {/* Status badge row */}
              <div style={{ padding: "0 1.5rem 1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <span className={`status-badge status-${selectedEmployee.status}`}>{selectedEmployee.status.replace("_", " ")}</span>
                <span className={`paycycle-badge ${selectedEmployee.payCycle}`} style={{ fontSize: "0.7rem" }}>{selectedEmployee.payCycle}</span>
                {selectedEmployee.contractType && (
                  <span style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", background: "var(--muted, #f3f4f6)", color: "var(--muted-text, #6b7280)" }}>
                    {selectedEmployee.contractType.replace("_", " ")}
                  </span>
                )}
              </div>

              <div className="detail-drawer-body" style={{ padding: "0 1.5rem", flex: 1, overflowY: "auto" }}>

                {/* Contact */}
                <div className="detail-section" style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.45, margin: "0 0 0.625rem" }}>Contact</h4>
                  {[
                    { label: "Email", value: selectedEmployee.email },
                    { label: "Phone", value: selectedEmployee.phone },
                    { label: "Location", value: selectedEmployee.location },
                  ].map(row => (
                    <div key={row.label} className="detail-row" style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border, #f3f4f6)", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.8125rem", opacity: 0.55, flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 500, textAlign: "right", wordBreak: "break-all" }}>{row.value || "—"}</span>
                    </div>
                  ))}
                </div>

                {/* Role */}
                <div className="detail-section" style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.45, margin: "0 0 0.625rem" }}>Role</h4>
                  {[
                    { label: "Department", value: selectedEmployee.department },
                    { label: "Position", value: selectedEmployee.position },
                    { label: "Designation", value: selectedEmployee.designation },
                    { label: "Hire Date", value: selectedEmployee.hireDate },
                  ].map(row => (
                    <div key={row.label} className="detail-row" style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border, #f3f4f6)", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.8125rem", opacity: 0.55, flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 500, textAlign: "right" }}>{row.value || "—"}</span>
                    </div>
                  ))}
                </div>

                {/* Payroll */}
                <div className="detail-section" style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.45, margin: "0 0 0.625rem" }}>Payroll</h4>
                  {[
                    { label: "Annual Salary", value: `$${selectedEmployee.salary.toLocaleString()}` },
                    { label: "Monthly Gross", value: `$${Math.round(selectedEmployee.salary / 12).toLocaleString()}` },
                    { label: "Pay Cycle", value: selectedEmployee.payCycle },
                  ].map(row => (
                    <div key={row.label} className="detail-row" style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border, #f3f4f6)", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.8125rem", opacity: 0.55, flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, textAlign: "right" }}>{row.value || "—"}</span>
                    </div>
                  ))}
                </div>

                {/* Banking */}
                <div className="detail-section" style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.45, margin: "0 0 0.625rem" }}>Banking</h4>
                  {[
                    { label: "Bank", value: selectedEmployee.bankName },
                    { label: "Account Name", value: selectedEmployee.bankAccountName },
                    { label: "Account No.", value: selectedEmployee.bankAccount },
                  ].map(row => (
                    <div key={row.label} className="detail-row" style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border, #f3f4f6)", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.8125rem", opacity: 0.55, flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 500, textAlign: "right" }}>{row.value || "—"}</span>
                    </div>
                  ))}
                </div>

                {/* Compliance */}
                <div className="detail-section" style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.45, margin: "0 0 0.625rem" }}>Compliance</h4>
                  {[
                    { label: "Tax ID", value: selectedEmployee.taxId },
                    { label: "NSSF", value: selectedEmployee.nssf },
                    { label: "NHIF", value: selectedEmployee.nhif },
                    { label: "PAYE", value: selectedEmployee.paye },
                  ].map(row => (
                    <div key={row.label} className="detail-row" style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border, #f3f4f6)", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.8125rem", opacity: 0.55, flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 500, textAlign: "right", fontFamily: "monospace" }}>{row.value || "—"}</span>
                    </div>
                  ))}
                </div>

              </div>

              {/* Drawer footer */}
              <div className="detail-drawer-actions" style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border, #e5e7eb)", display: "flex", gap: "0.625rem" }}>
                <button className="btn btn-secondary" style={{ flex: 1, fontSize: "0.875rem" }} type="button"
                  onClick={() => { setShowDetails(false); openEditForm(selectedEmployee); }}>
                  Edit
                </button>
                <button className="danger btn" style={{ fontSize: "0.875rem" }} type="button"
                  onClick={() => { setShowDetails(false); setConfirmDeleteEmployee(selectedEmployee); }}>
                  Delete
                </button>
              </div>
            </aside>
          </>
        )}

      </section>
    </main>
  );
}
