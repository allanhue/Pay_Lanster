"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api, type PayrollEmployee } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

export default function EmployeePage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [salary, setSalary] = useState("");
  const [payCycle, setPayCycle] = useState<"monthly" | "biweekly">("monthly");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
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

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.orgId) {
      return;
    }

    setError("");
    setSaving(true);
    try {
      await api.addEmployee({
        orgId: session.orgId,
        fullName,
        email,
        department,
        salary: Number(salary),
        payCycle,
      });

      setFullName("");
      setEmail("");
      setDepartment("");
      setSalary("");
      setPayCycle("monthly");
      await refresh(session.orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add employee");
    } finally {
      setSaving(false);
    }
  };

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = [...new Set(employees.map(emp => emp.department).filter(Boolean))];
    return depts.sort();
  }, [employees]);

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
        (filterStatus === "active" && employee.salary > 0) ||
        (filterStatus === "inactive" && employee.salary === 0);

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

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <div className="page-header">
          <h1>Employees</h1>
          <p>Manage your team and payroll information</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="cards-grid two-col">
          <article className="panel panel-elevated">
            <div className="panel-header">
              <h2>Add Employee</h2>
              <p>Quickly add new team members to your organization</p>
            </div>
            <form className="form-grid form-two-col" onSubmit={onAdd}>
              <div className="form-group">
                <label htmlFor="employeeName">Full name *</label>
                <input 
                  id="employeeName" 
                  onChange={(e) => setFullName(e.target.value)} 
                  placeholder="Enter full name" 
                  required 
                  value={fullName} 
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label htmlFor="employeeEmail">Email *</label>
                <input 
                  id="employeeEmail" 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="email@company.com" 
                  required 
                  type="email" 
                  value={email}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label htmlFor="employeeDepartment">Department *</label>
                <input
                  id="employeeDepartment"
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g., Engineering, Sales, HR"
                  required
                  value={department}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label htmlFor="employeeSalary">Annual salary *</label>
                <div className="input-with-suffix">
                  <input
                    id="employeeSalary"
                    min={0}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder="0.00"
                    required
                    type="number"
                    value={salary}
                    disabled={saving}
                  />
                  <span className="input-suffix">USD</span>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="employeeCycle">Pay cycle *</label>
                <select 
                  id="employeeCycle" 
                  onChange={(e) => setPayCycle(e.target.value as "monthly" | "biweekly")} 
                  value={payCycle}
                  disabled={saving}
                >
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Biweekly</option>
                </select>
              </div>
              <div className="form-actions">
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setFullName("");
                    setEmail("");
                    setDepartment("");
                    setSalary("");
                    setPayCycle("monthly");
                  }}
                  disabled={saving}
                >
                  Clear
                </button>
                <button 
                  className={`btn btn-primary ${saving ? "btn-loading" : ""}`} 
                  disabled={saving} 
                  type="submit"
                >
                  {saving && <span className="btn-spinner" />}
                  {saving ? "Adding..." : "Add Employee"}
                </button>
              </div>
            </form>
          </article>

          <article className="panel panel-elevated">
            <div className="panel-header">
              <h2>Employee Statistics</h2>
              <p>Quick overview of your team</p>
            </div>
            <div className="cards-grid two-col">
              <div className="card-metric">
                <span className="metric-label">Total Employees</span>
                <span className="metric-value">{employees.length}</span>
                <span className="metric-sublabel">Active team members</span>
              </div>
              <div className="card-metric">
                <span className="metric-label">Departments</span>
                <span className="metric-value">{departments.length}</span>
                <span className="metric-sublabel">Teams</span>
              </div>
              <div className="card-metric">
                <span className="metric-label">Monthly Payroll</span>
                <span className="metric-value">
                  ${employees
                    .filter(emp => emp.payCycle === "monthly")
                    .reduce((sum, emp) => sum + emp.salary, 0)
                    .toLocaleString()}
                </span>
                <span className="metric-sublabel">Per month</span>
              </div>
              <div className="card-metric">
                <span className="metric-label">Biweekly Payroll</span>
                <span className="metric-value">
                  ${employees
                    .filter(emp => emp.payCycle === "biweekly")
                    .reduce((sum, emp) => sum + emp.salary / 26, 0)
                    .toLocaleString()}
                </span>
                <span className="metric-sublabel">Per period</span>
              </div>
            </div>
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
                  <option value="inactive">Inactive</option>
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
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="sortable" onClick={() => handleSort("email")}>
                      <div className="sort-header">
                        <span>Email</span>
                        {sortBy === "email" && (
                          <span className="sort-indicator">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="sortable" onClick={() => handleSort("department")}>
                      <div className="sort-header">
                        <span>Department</span>
                        {sortBy === "department" && (
                          <span className="sort-indicator">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="sortable" onClick={() => handleSort("payCycle")}>
                      <div className="sort-header">
                        <span>Pay Cycle</span>
                        {sortBy === "payCycle" && (
                          <span className="sort-indicator">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="sortable" onClick={() => handleSort("salary")}>
                      <div className="sort-header">
                        <span>Annual Salary</span>
                        {sortBy === "salary" && (
                          <span className="sort-indicator">
                            {sortOrder === "asc" ? "↑" : "↓"}
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
                    <tr key={employee.id}>
                      <td>
                        <div className="employee-info">
                          <div className="employee-avatar">
                            {employee.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div className="employee-details">
                            <span className="employee-name">{employee.fullName}</span>
                            <span className="employee-id">ID: {employee.id.slice(-8)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <a href={`mailto:${employee.email}`} className="employee-email">
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
                        <span className={`status-badge ${employee.salary > 0 ? "active" : "inactive"}`}>
                          {employee.salary > 0 ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn edit-btn" title="Edit Employee">
                            <svg viewBox="0 0 24 24">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          </button>
                          <button className="action-btn delete-btn" title="Delete Employee">
                            <svg viewBox="0 0 24 24">
                              <polyline points="3,6 5,6 21,6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          </button>
                        </div>
                      </td>
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
