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
  const [showAdvanced, setShowAdvanced] = useState(false);
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
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    if (current.role !== "org_admin" || !current.orgId) {
      router.replace("/system_admin/Dasboard");
      return;
    }

    setSession(current);
    void refresh(current.orgId).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load employees");
    });
  }, [router]);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setTitle("");
    setPosition("");
    setDesignation("");
    setDepartment("");
    setSalary("");
    setPayCycle("monthly");
    setStatus("active");
    setContractType("full_time");
    setTaxId("");
    setNssf("");
    setNhif("");
    setPaye("");
    setBankName("");
    setBankAccountName("");
    setBankAccount("");
    setLocation("");
    setHireDate("");
  };

  const openAddForm = () => {
    setEditingEmployee(null);
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (employee: PayrollEmployee) => {
    setEditingEmployee(employee);
    setFullName(employee.fullName);
    setEmail(employee.email);
    setPhone(employee.phone || "");
    setTitle(employee.title || "");
    setPosition(employee.position || "");
    setDesignation(employee.designation || "");
    setDepartment(employee.department);
    setSalary(String(employee.salary));
    setPayCycle(employee.payCycle);
    setStatus(employee.status);
    setContractType(employee.contractType || "full_time");
    setTaxId(employee.taxId || "");
    setNssf(employee.nssf || "");
    setNhif(employee.nhif || "");
    setPaye(employee.paye || "");
    setBankName(employee.bankName || "");
    setBankAccountName(employee.bankAccountName || "");
    setBankAccount(employee.bankAccount || "");
    setLocation(employee.location || "");
    setHireDate(employee.hireDate || "");
    setShowForm(true);
  };

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.orgId) {
      return;
    }

    setError("");
    setSaving(true);
    try {
      if (editingEmployee) {
        await api.updateEmployee({
          id: editingEmployee.id,
          orgId: session.orgId,
          fullName,
          email,
          phone,
          title,
          position,
          designation,
          department,
          salary: Number(salary),
          payCycle,
          status,
          contractType,
          taxId,
          nssf,
          nhif,
          paye,
          bankName,
          bankAccountName,
          bankAccount,
          location,
          hireDate,
        });
      } else {
        await api.addEmployee({
          orgId: session.orgId,
          fullName,
          email,
          phone,
          title,
          position,
          designation,
          department,
          salary: Number(salary),
          payCycle,
          status,
          contractType,
          taxId,
          nssf,
          nhif,
          paye,
          bankName,
          bankAccountName,
          bankAccount,
          location,
          hireDate,
        });
      }

      resetForm();
      setEditingEmployee(null);
      setShowForm(false);
      await refresh(session.orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save employee");
    } finally {
      setSaving(false);
    }
  };

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = [...new Set(employees.map((emp) => emp.department).filter(Boolean))];
    return depts.sort();
  }, [employees]);

  const activeEmployees = useMemo(() => employees.filter((emp) => emp.status === "active").length, [employees]);
  const onLeaveEmployees = useMemo(() => employees.filter((emp) => emp.status === "on_leave").length, [employees]);
  const terminatedEmployees = useMemo(() => employees.filter((emp) => emp.status === "terminated").length, [employees]);

  const monthlyPayroll = useMemo(
    () => employees.filter((emp) => emp.payCycle === "monthly" && emp.status === "active").reduce((sum, emp) => sum + emp.salary, 0),
    [employees]
  );

  const biweeklyPayroll = useMemo(
    () => employees.filter((emp) => emp.payCycle === "biweekly" && emp.status === "active").reduce((sum, emp) => sum + emp.salary / 26, 0),
    [employees]
  );

  // Filter and sort employees
  const filteredAndSortedEmployees = useMemo(() => {
    let filtered = employees.filter(employee => {
      const matchesSearch = searchQuery === "" || 
        employee.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.department.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDepartment = filterDepartment === "all" || employee.department === filterDepartment;
      const matchesPayCycle = filterPayCycle === "all" || employee.payCycle === filterPayCycle;
      const matchesStatus = filterStatus === "all" || 
        employee.status === filterStatus;

      return matchesSearch && matchesDepartment && matchesPayCycle && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case "name":
          aValue = a.fullName.toLowerCase();
          bValue = b.fullName.toLowerCase();
          break;
        case "email":
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case "department":
          aValue = a.department.toLowerCase();
          bValue = b.department.toLowerCase();
          break;
        case "salary":
          aValue = a.salary;
          bValue = b.salary;
          break;
        case "payCycle":
          aValue = a.payCycle;
          bValue = b.payCycle;
          break;
        default:
          aValue = a.fullName.toLowerCase();
          bValue = b.fullName.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [employees, searchQuery, filterDepartment, filterPayCycle, filterStatus, sortBy, sortOrder]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
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

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide">
        <div className="page-header-row">
          <div className="page-header">
            <div className="page-header-content">
              <h1>Employees</h1>
              <p>Manage your team and payroll information</p>
            </div>
            <ModuleActions />
          </div>
          <div className="page-header-meta">
            <span className="stat-chip">Active: {activeEmployees}</span>
            <span className="stat-chip">Monthly payroll: ${monthlyPayroll.toLocaleString()}</span>
            <div className="page-header-actions">
              <button className="btn btn-primary btn-sm" type="button" onClick={openAddForm}>
                Add Employee
              </button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowImport(true)}>
                Import
              </button>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="cards-grid three-col">
          <article className="card card-metric">
            <span className="metric-label">Active</span>
            <span className="metric-value">{activeEmployees}</span>
            <span className="metric-sublabel">Currently employed</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">On Leave</span>
            <span className="metric-value">{onLeaveEmployees}</span>
            <span className="metric-sublabel">Temporarily inactive</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Terminated</span>
            <span className="metric-value">{terminatedEmployees}</span>
            <span className="metric-sublabel">Archived records</span>
          </article>
        </div>


        <article className="panel panel-elevated">
          <div className="panel-header">
            <h2>Employee List</h2>
            <p>Manage and view all employee information</p>
          </div>

          {/* Filters and Search */}
          <div className="employee-filters">
            <div className="filter-row">
              <div className="form-group">
                <label htmlFor="searchEmployees">Search</label>
                <div className="search-input-wrapper">
                  <svg viewBox="0 0 24 24" className="search-icon">
                    <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M21 21l-4.35-4.35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input
                    id="searchEmployees"
                    type="text"
                    placeholder="Search by name, email, or department..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="filter-row">
              <div className="form-group">
                <label htmlFor="filterDepartment">Department</label>
                <select 
                  id="filterDepartment" 
                  value={filterDepartment} 
                  onChange={(e) => setFilterDepartment(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="filterPayCycle">Pay Cycle</label>
                <select 
                  id="filterPayCycle" 
                  value={filterPayCycle} 
                  onChange={(e) => setFilterPayCycle(e.target.value)}
                >
                  <option value="all">All Cycles</option>
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Biweekly</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="filterStatus">Status</label>
                <select 
                  id="filterStatus" 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="on_leave">On leave</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
              
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterDepartment("all");
                  setFilterPayCycle("all");
                  setFilterStatus("all");
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>

          {(!Array.isArray(filteredAndSortedEmployees) || filteredAndSortedEmployees.length === 0) ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" className="empty-icon">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 3.13a4 4 0 010 7.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <p>No employees found matching your criteria.</p>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterDepartment("all");
                  setFilterPayCycle("all");
                  setFilterStatus("all");
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table employee-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort("name")}>
                      <div className="sort-header">
                        <span>Employee</span>
                        {sortBy === "name" && (
                          <span className="sort-indicator">
                            {sortOrder === "asc" ? "^" : "v"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="sortable" onClick={() => handleSort("email")}>
                      <div className="sort-header">
                        <span>Email</span>
                        {sortBy === "email" && (
                          <span className="sort-indicator">
                            {sortOrder === "asc" ? "^" : "v"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="sortable" onClick={() => handleSort("department")}>
                      <div className="sort-header">
                        <span>Department</span>
                        {sortBy === "department" && (
                          <span className="sort-indicator">
                            {sortOrder === "asc" ? "^" : "v"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="sortable" onClick={() => handleSort("payCycle")}>
                      <div className="sort-header">
                        <span>Pay Cycle</span>
                        {sortBy === "payCycle" && (
                          <span className="sort-indicator">
                            {sortOrder === "asc" ? "^" : "v"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="sortable" onClick={() => handleSort("salary")}>
                      <div className="sort-header">
                        <span>Annual Salary</span>
                        {sortBy === "salary" && (
                          <span className="sort-indicator">
                            {sortOrder === "asc" ? "^" : "v"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th>Monthly Pay</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="clickable-row"
                      onClick={() => {
                        setSelectedEmployee(employee);
                        setShowDetails(true);
                      }}
                    >
                      <td>
                        <div className="employee-info no-avatar">
                          <div className="employee-details">
                            <span className="employee-name">{employee.fullName}</span>
                            <span className="employee-id">ID: {employee.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <a
                          href={`mailto:${employee.email}`}
                          className="employee-email"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {employee.email}
                        </a>
                      </td>
                      <td>
                        <span className="department-badge">{employee.department}</span>
                      </td>
                      <td>
                        <span className={`paycycle-badge ${employee.payCycle}`}>
                          {employee.payCycle === "monthly" ? "Monthly" : "Biweekly"}
                        </span>
                      </td>
                      <td>
                        <span className="salary-amount">${employee.salary.toLocaleString()}</span>
                      </td>
                      <td>
                        <span className="monthly-pay">
                          ${employee.payCycle === "monthly" 
                            ? employee.salary.toLocaleString()
                            : Math.round(employee.salary / 26).toLocaleString()
                          }
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-${employee.status}`}>
                          {employee.status.replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        <button
                          className="action-menu-btn"
                          type="button"
                          title="Employee actions"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActionEmployee(employee);
                          }}
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

        {showForm && (
          <div className="modal-backdrop" onClick={() => { setShowForm(false); setEditingEmployee(null); }}>
            <div className="modal-content modal-large" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingEmployee ? "Edit Employee" : "Add Employee"}</h3>
                <button className="modal-close" onClick={() => { setShowForm(false); setEditingEmployee(null); }} type="button">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <form className="form-grid form-two-col" onSubmit={onAdd}>
                  <div className="form-group">
                    <label htmlFor="employeeFullName">Full Name</label>
                    <input
                      id="employeeFullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g., Jane Adams"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeEmail">Email</label>
                    <input
                      id="employeeEmail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeePhone">Phone Number</label>
                    <input
                      id="employeePhone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+254..."
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeDepartment">Department</label>
                    <input
                      id="employeeDepartment"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g., Operations"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeTitle">Title</label>
                    <input
                      id="employeeTitle"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Senior Analyst"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeePosition">Position</label>
                    <input
                      id="employeePosition"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="e.g., Payroll Specialist"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeDesignation">Designation</label>
                    <input
                      id="employeeDesignation"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g., Grade 5"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeSalary">Annual Salary</label>
                    <input
                      id="employeeSalary"
                      type="number"
                      min={0}
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                      placeholder="0"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeePayCycle">Pay Cycle</label>
                    <select id="employeePayCycle" value={payCycle} onChange={(e) => setPayCycle(e.target.value as typeof payCycle)}>
                      <option value="monthly">Monthly</option>
                      <option value="biweekly">Biweekly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeStatus">Status</label>
                    <select id="employeeStatus" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                      <option value="active">Active</option>
                      <option value="on_leave">On leave</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeContractType">Contract Type</label>
                    <input
                      id="employeeContractType"
                      value={contractType}
                      onChange={(e) => setContractType(e.target.value)}
                      placeholder="full_time"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeLocation">Location</label>
                    <input
                      id="employeeLocation"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Nairobi"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeHireDate">Hire Date</label>
                    <input
                      id="employeeHireDate"
                      type="date"
                      value={hireDate}
                      onChange={(e) => setHireDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeBankName">Bank Name</label>
                    <input
                      id="employeeBankName"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g., KCB"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeBankAccountName">Bank Account Name</label>
                    <input
                      id="employeeBankAccountName"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="Account name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeBankAccount">Bank Account Number</label>
                    <input
                      id="employeeBankAccount"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="Account number"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeTaxId">Tax ID</label>
                    <input
                      id="employeeTaxId"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="KRA PIN"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeNssf">NSSF</label>
                    <input
                      id="employeeNssf"
                      value={nssf}
                      onChange={(e) => setNssf(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeeNhif">NHIF</label>
                    <input
                      id="employeeNhif"
                      value={nhif}
                      onChange={(e) => setNhif(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employeePaye">PAYE</label>
                    <input
                      id="employeePaye"
                      value={paye}
                      onChange={(e) => setPaye(e.target.value)}
                    />
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => { setShowForm(false); setEditingEmployee(null); }}>
                      Cancel
                    </button>
                    <button className={`btn btn-primary ${saving ? "btn-loading" : ""}`} type="submit" disabled={saving}>
                      {saving && <span className="btn-spinner" />}
                      {saving ? "Saving..." : editingEmployee ? "Save Changes" : "Add Employee"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {actionEmployee && (
          <div className="modal-backdrop" onClick={() => setActionEmployee(null)}>
            <div className="modal-content modal-mini" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>Employee Actions</h3>
                <button className="modal-close" onClick={() => setActionEmployee(null)} type="button">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <div className="action-menu">
                  <button
                    className="action-menu-item"
                    type="button"
                    onClick={() => {
                      setSelectedEmployee(actionEmployee);
                      setShowDetails(true);
                      setActionEmployee(null);
                    }}
                  >
                    View details
                  </button>
                  <button
                    className="action-menu-item"
                    type="button"
                    onClick={() => {
                      openEditForm(actionEmployee);
                      setActionEmployee(null);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="action-menu-item danger"
                    type="button"
                    onClick={() => {
                      setConfirmDeleteEmployee(actionEmployee);
                      setActionEmployee(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {confirmDeleteEmployee && (
          <div className="modal-backdrop" onClick={() => setConfirmDeleteEmployee(null)}>
            <div className="modal-content modal-mini" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>Delete Employee</h3>
                <button className="modal-close" onClick={() => setConfirmDeleteEmployee(null)} type="button">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <p className="muted-text">Delete {confirmDeleteEmployee.fullName}? This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setConfirmDeleteEmployee(null)}>
                  Cancel
                </button>
                <button
                  className="danger"
                  type="button"
                  onClick={() => {
                    onDeleteEmployee(confirmDeleteEmployee);
                    setConfirmDeleteEmployee(null);
                  }}
                  disabled={deleting === confirmDeleteEmployee.id}
                >
                  {deleting === confirmDeleteEmployee.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showImport && (
          <div className="modal-backdrop" onClick={() => setShowImport(false)}>
            <div className="modal-content" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>Import Employees</h3>
                <button className="modal-close" onClick={() => setShowImport(false)} type="button">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <p className="muted">Upload a CSV with columns: fullName, email, department, salary, payCycle.</p>
                <div className="form-group">
                  <label htmlFor="employeeImport">CSV file</label>
                  <input id="employeeImport" type="file" accept=".csv" />
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => setShowImport(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button">
                    Upload
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDetails && selectedEmployee && (
          <>
            <button className="detail-drawer-backdrop" type="button" onClick={() => setShowDetails(false)} aria-label="Close details" />
            <aside className="detail-drawer" aria-label="Employee details">
              <div className="detail-drawer-header">
                <div className="detail-avatar">
                  {selectedEmployee.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                </div>
                <div className="detail-header-text">
                  <h3>{selectedEmployee.fullName}</h3>
                  <span className="detail-id">{selectedEmployee.id}</span>
                  <span className="detail-sub">
                    {(selectedEmployee.title || selectedEmployee.position || selectedEmployee.designation || selectedEmployee.department || "").toString()}
                  </span>
                </div>
                <button className="detail-close" type="button" onClick={() => setShowDetails(false)}>
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="detail-drawer-body">
                <div className="detail-section">
                  <h4>Contact</h4>
                  <div className="detail-grid">
                    <div className="detail-row">
                      <span className="detail-label">Email</span>
                      <span className="detail-value">{selectedEmployee.email || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Phone</span>
                      <span className="detail-value">{selectedEmployee.phone || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Location</span>
                      <span className="detail-value">{selectedEmployee.location || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Role & Status</h4>
                  <div className="detail-grid">
                    <div className="detail-row">
                      <span className="detail-label">Department</span>
                      <span className="detail-value">{selectedEmployee.department || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Title</span>
                      <span className="detail-value">{selectedEmployee.title || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Position</span>
                      <span className="detail-value">{selectedEmployee.position || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Designation</span>
                      <span className="detail-value">{selectedEmployee.designation || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Status</span>
                      <span className="detail-value">{selectedEmployee.status.replace("_", " ")}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Hire Date</span>
                      <span className="detail-value">{selectedEmployee.hireDate || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Payroll</h4>
                  <div className="detail-grid">
                    <div className="detail-row">
                      <span className="detail-label">Pay Cycle</span>
                      <span className="detail-value">{selectedEmployee.payCycle}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Annual Salary</span>
                      <span className="detail-value">${selectedEmployee.salary.toLocaleString()}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Contract</span>
                      <span className="detail-value">{selectedEmployee.contractType || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Banking</h4>
                  <div className="detail-grid">
                    <div className="detail-row">
                      <span className="detail-label">Bank Name</span>
                      <span className="detail-value">{selectedEmployee.bankName || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Account Name</span>
                      <span className="detail-value">{selectedEmployee.bankAccountName || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Account Number</span>
                      <span className="detail-value">{selectedEmployee.bankAccount || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Compliance</h4>
                  <div className="detail-grid">
                    <div className="detail-row">
                      <span className="detail-label">Tax ID</span>
                      <span className="detail-value">{selectedEmployee.taxId || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">NSSF</span>
                      <span className="detail-value">{selectedEmployee.nssf || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">NHIF</span>
                      <span className="detail-value">{selectedEmployee.nhif || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">PAYE</span>
                      <span className="detail-value">{selectedEmployee.paye || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="detail-drawer-actions">
                <button className="btn btn-secondary" type="button" onClick={() => { setShowDetails(false); openEditForm(selectedEmployee); }}>
                  Edit
                </button>
                <button className="danger" type="button" onClick={() => { setShowDetails(false); setConfirmDeleteEmployee(selectedEmployee); }}>
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
