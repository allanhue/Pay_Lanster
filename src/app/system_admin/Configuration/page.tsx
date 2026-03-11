"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

interface Organization {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  industry: string;
  size: string;
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  adminUser: string;
  employeeCount: number;
  monthlyPayroll: number;
  subscriptionPlan: "basic" | "professional" | "enterprise";
  billingCycle: "monthly" | "yearly";
  nextBillingDate: string;
}

export default function ConfigurationPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [maintenanceWindow, setMaintenanceWindow] = useState("Sunday 02:00 UTC");
  const [defaultTrialDays, setDefaultTrialDays] = useState(14);
  const [allowTenantSignup, setAllowTenantSignup] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("organizations");
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [showEditOrg, setShowEditOrg] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    industry: "",
    size: "",
    adminUser: "",
    subscriptionPlan: "basic" as const,
    billingCycle: "monthly" as const
  });
  const router = useRouter();

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    if (current.role !== "system_admin") {
      router.replace("/pages/Settings");
      return;
    }
    setSession(current);
    loadOrganizations();
  }, [router]);

  const loadOrganizations = async () => {
    try {
      // Mock data - replace with actual API call
      const mockOrgs: Organization[] = [
        {
          id: "org_001",
          name: "Tech Corp",
          email: "admin@techcorp.com",
          phone: "+1-555-0101",
          address: "123 Tech Street",
          city: "San Francisco",
          country: "United States",
          industry: "Technology",
          size: "51-200",
          status: "active",
          createdAt: "2024-01-15",
          adminUser: "john.doe@techcorp.com",
          employeeCount: 85,
          monthlyPayroll: 425000,
          subscriptionPlan: "professional",
          billingCycle: "monthly",
          nextBillingDate: "2026-04-15"
        },
        {
          id: "org_002",
          name: "Marketing Agency",
          email: "info@marketingagency.com",
          phone: "+1-555-0102",
          address: "456 Creative Ave",
          city: "New York",
          country: "United States",
          industry: "Marketing",
          size: "11-50",
          status: "active",
          createdAt: "2024-02-20",
          adminUser: "jane.smith@marketingagency.com",
          employeeCount: 32,
          monthlyPayroll: 180000,
          subscriptionPlan: "basic",
          billingCycle: "yearly",
          nextBillingDate: "2027-02-20"
        },
        {
          id: "org_003",
          name: "Design Studio",
          email: "hello@designstudio.com",
          phone: "+1-555-0103",
          address: "789 Art Boulevard",
          city: "Los Angeles",
          country: "United States",
          industry: "Design",
          size: "1-10",
          status: "inactive",
          createdAt: "2024-03-10",
          adminUser: "mike.wilson@designstudio.com",
          employeeCount: 8,
          monthlyPayroll: 45000,
          subscriptionPlan: "basic",
          billingCycle: "monthly",
          nextBillingDate: "2026-04-10"
        },
        {
          id: "org_004",
          name: "Consulting Firm",
          email: "contact@consultingfirm.com",
          phone: "+1-555-0104",
          address: "321 Business Park",
          city: "Chicago",
          country: "United States",
          industry: "Consulting",
          size: "201-500",
          status: "active",
          createdAt: "2024-01-05",
          adminUser: "sarah.brown@consultingfirm.com",
          employeeCount: 250,
          monthlyPayroll: 1500000,
          subscriptionPlan: "enterprise",
          billingCycle: "yearly",
          nextBillingDate: "2027-01-05"
        },
        {
          id: "org_005",
          name: "Software Solutions",
          email: "support@softwaresolutions.com",
          phone: "+1-555-0105",
          address: "654 Code Lane",
          city: "Austin",
          country: "United States",
          industry: "Software",
          size: "51-200",
          status: "suspended",
          createdAt: "2024-04-12",
          adminUser: "david.jones@softwaresolutions.com",
          employeeCount: 120,
          monthlyPayroll: 720000,
          subscriptionPlan: "professional",
          billingCycle: "monthly",
          nextBillingDate: "2026-04-12"
        }
      ];
      setOrganizations(mockOrgs);
    } catch (error) {
      console.error("Failed to load organizations:", error);
    }
  };

  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = searchQuery === "" || 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.adminUser.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || org.status === filterStatus;
    const matchesPlan = filterPlan === "all" || org.subscriptionPlan === filterPlan;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "status-completed";
      case "inactive": return "status-draft";
      case "suspended": return "status-badge";
      default: return "";
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "basic": return "plan-basic";
      case "professional": return "plan-professional";
      case "enterprise": return "plan-enterprise";
      default: return "";
    }
  };

  const handleAddOrganization = () => {
    const newOrg: Organization = {
      id: `org_${Date.now()}`,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      country: formData.country,
      industry: formData.industry,
      size: formData.size,
      status: "active",
      createdAt: new Date().toISOString().split('T')[0],
      adminUser: formData.adminUser,
      employeeCount: 0,
      monthlyPayroll: 0,
      subscriptionPlan: formData.subscriptionPlan,
      billingCycle: formData.billingCycle,
      nextBillingDate: formData.billingCycle === "yearly" 
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    setOrganizations([...organizations, newOrg]);
    setShowAddOrg(false);
    resetForm();
    setMessage("Organization added successfully!");
  };

  const handleEditOrganization = () => {
    if (!selectedOrg) return;

    const updatedOrgs = organizations.map(org => 
      org.id === selectedOrg.id 
        ? { ...org, ...formData }
        : org
    );

    setOrganizations(updatedOrgs);
    setShowEditOrg(false);
    setSelectedOrg(null);
    resetForm();
    setMessage("Organization updated successfully!");
  };

  const handleDeleteOrganization = (orgId: string) => {
    setOrganizations(organizations.filter(org => org.id !== orgId));
    setMessage("Organization deleted successfully!");
  };

  const handleStatusChange = (orgId: string, newStatus: "active" | "inactive" | "suspended") => {
    const updatedOrgs = organizations.map(org => 
      org.id === orgId ? { ...org, status: newStatus } : org
    );
    setOrganizations(updatedOrgs);
    setMessage(`Organization status changed to ${newStatus}`);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      industry: "",
      size: "",
      adminUser: "",
      subscriptionPlan: "basic",
      billingCycle: "monthly"
    });
  };

  const openEditModal = (org: Organization) => {
    setSelectedOrg(org);
    setFormData({
      name: org.name,
      email: org.email,
      phone: org.phone,
      address: org.address,
      city: org.city,
      country: org.country,
      industry: org.industry,
      size: org.size,
      adminUser: org.adminUser,
      subscriptionPlan: org.subscriptionPlan,
      billingCycle: org.billingCycle
    });
    setShowEditOrg(true);
  };

  const saveConfiguration = () => {
    setMessage("Platform configuration saved successfully!");
    setTimeout(() => setMessage(""), 3000);
  };

  const totalOrgs = organizations.length;
  const activeOrgs = organizations.filter(org => org.status === "active").length;
  const totalEmployees = organizations.reduce((sum, org) => sum + org.employeeCount, 0);
  const totalPayroll = organizations.reduce((sum, org) => sum + org.monthlyPayroll, 0);

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <div className="page-header">
          <h1>Configuration</h1>
          <p>Manage organizations, system settings, and platform configuration</p>
        </div>

        {message && <div className="alert alert-success">{message}</div>}

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === "organizations" ? "active" : ""}`}
            onClick={() => setActiveTab("organizations")}
          >
            Organizations
          </button>
          <button 
            className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Platform Settings
          </button>
        </div>

        {/* Organizations Tab */}
        {activeTab === "organizations" && (
          <>
            {/* Overview Statistics */}
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
                  <span className="metric-value">{totalOrgs}</span>
                  <span className="metric-sublabel">Registered companies</span>
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
                  <span className="metric-label">Active Organizations</span>
                  <span className="metric-value">{activeOrgs}</span>
                  <span className="metric-sublabel">Currently operational</span>
                </div>
              </div>

              <div className="card-metric card-metric-enhanced">
                <div className="metric-icon metric-icon-warning">
                  <svg viewBox="0 0 24 24">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
                <div className="metric-content">
                  <span className="metric-label">Total Employees</span>
                  <span className="metric-value">{totalEmployees.toLocaleString()}</span>
                  <span className="metric-sublabel">Across all orgs</span>
                </div>
              </div>

              <div className="card-metric card-metric-enhanced">
                <div className="metric-icon metric-icon-info">
                  <svg viewBox="0 0 24 24">
                    <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M7 8h10M7 12h10M7 16h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="metric-content">
                  <span className="metric-label">Total Monthly Payroll</span>
                  <span className="metric-value">${totalPayroll.toLocaleString()}</span>
                  <span className="metric-sublabel">Platform-wide</span>
                </div>
              </div>
            </div>

            {/* Organizations Management */}
            <div className="panel panel-elevated">
              <div className="panel-header">
                <h2>Organizations Management</h2>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowAddOrg(true)}
                >
                  Add Organization
                </button>
              </div>

              {/* Filters */}
              <div className="filter-row">
                <div className="form-group">
                  <label htmlFor="searchOrgs">Search</label>
                  <div className="search-input-wrapper">
                    <svg viewBox="0 0 24 24" className="search-icon">
                      <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M21 21l-4.35-4.35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <input
                      id="searchOrgs"
                      type="text"
                      placeholder="Search organizations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
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
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="filterPlan">Subscription Plan</label>
                  <select 
                    id="filterPlan" 
                    value={filterPlan} 
                    onChange={(e) => setFilterPlan(e.target.value)}
                  >
                    <option value="all">All Plans</option>
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                    setFilterPlan("all");
                  }}
                >
                  Clear Filters
                </button>
              </div>

              {/* Organizations Table */}
              {filteredOrganizations.length === 0 ? (
                <div className="empty-state">
                  <svg viewBox="0 0 24 24" className="empty-icon">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <p>No organizations found matching your criteria.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table organizations-table">
                    <thead>
                      <tr>
                        <th>Organization</th>
                        <th>Admin User</th>
                        <th>Industry</th>
                        <th>Size</th>
                        <th>Employees</th>
                        <th>Monthly Payroll</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrganizations.map((org) => (
                        <tr key={org.id}>
                          <td>
                            <div className="org-info">
                              <div className="org-avatar">
                                {org.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </div>
                              <div className="org-details">
                                <div className="org-name">{org.name}</div>
                                <div className="org-email">{org.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="admin-info">
                              <span className="admin-email">{org.adminUser}</span>
                              <span className="org-phone">{org.phone}</span>
                            </div>
                          </td>
                          <td>
                            <span className="industry-tag">{org.industry}</span>
                          </td>
                          <td>
                            <span className="size-tag">{org.size}</span>
                          </td>
                          <td>
                            <span className="employee-count">{org.employeeCount}</span>
                          </td>
                          <td>
                            <span className="payroll-amount">${org.monthlyPayroll.toLocaleString()}</span>
                          </td>
                          <td>
                            <span className={`plan-badge ${getPlanColor(org.subscriptionPlan)}`}>
                              {org.subscriptionPlan.charAt(0).toUpperCase() + org.subscriptionPlan.slice(1)}
                            </span>
                            <div className="billing-cycle">{org.billingCycle}</div>
                          </td>
                          <td>
                            <span className={`status-badge ${getStatusColor(org.status)}`}>
                              {org.status.charAt(0).toUpperCase() + org.status.slice(1)}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="action-btn edit-btn"
                                onClick={() => openEditModal(org)}
                                title="Edit Organization"
                              >
                                <svg viewBox="0 0 24 24">
                                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" fill="none" stroke="currentColor" strokeWidth="1.5" />
                                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                                </svg>
                              </button>
                              <select 
                                className="status-select"
                                value={org.status}
                                onChange={(e) => handleStatusChange(org.id, e.target.value as any)}
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="suspended">Suspended</option>
                              </select>
                              <button 
                                className="action-btn delete-btn"
                                onClick={() => handleDeleteOrganization(org.id)}
                                title="Delete Organization"
                              >
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
            </div>
          </>
        )}

        {/* Platform Settings Tab */}
        {activeTab === "settings" && (
          <div className="panel panel-elevated">
            <div className="panel-header">
              <h2>Platform Configuration</h2>
              <p>System admin controls tenant onboarding and platform defaults</p>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="window">Maintenance Window</label>
                <input
                  id="window"
                  onChange={(e) => setMaintenanceWindow(e.target.value)}
                  value={maintenanceWindow}
                  placeholder="Sunday 02:00 UTC"
                />
                <small>Regular maintenance window for system updates</small>
              </div>

              <div className="form-group">
                <label htmlFor="trial">Default Trial Days</label>
                <input
                  id="trial"
                  min={1}
                  onChange={(e) => setDefaultTrialDays(Number(e.target.value))}
                  type="number"
                  value={defaultTrialDays}
                />
                <small>Number of trial days for new organizations</small>
              </div>

              <div className="form-group">
                <label htmlFor="signup">Allow New Tenant Signup</label>
                <select
                  id="signup"
                  onChange={(e) => setAllowTenantSignup(e.target.value === "yes")}
                  value={allowTenantSignup ? "yes" : "no"}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                <small>Control whether new organizations can self-register</small>
              </div>

              <div className="form-group full-width">
                <button
                  onClick={saveConfiguration}
                  type="button"
                  className="btn btn-primary"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Organization Modal */}
        {showAddOrg && (
          <div className="modal-backdrop" onClick={() => setShowAddOrg(false)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Add New Organization</h3>
                <button className="modal-close" onClick={() => setShowAddOrg(false)}>
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="orgName">Organization Name *</label>
                    <input
                      id="orgName"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter organization name"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="orgEmail">Email Address *</label>
                    <input
                      id="orgEmail"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="organization@company.com"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="orgPhone">Phone Number</label>
                    <input
                      id="orgPhone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+1-555-0123"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="adminUser">Admin User Email *</label>
                    <input
                      id="adminUser"
                      type="email"
                      value={formData.adminUser}
                      onChange={(e) => setFormData({...formData, adminUser: e.target.value})}
                      placeholder="admin@company.com"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="orgAddress">Address</label>
                    <input
                      id="orgAddress"
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="123 Main Street"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="orgCity">City</label>
                    <input
                      id="orgCity"
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      placeholder="New York"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="orgCountry">Country</label>
                    <input
                      id="orgCountry"
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      placeholder="United States"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="orgIndustry">Industry</label>
                    <select
                      id="orgIndustry"
                      value={formData.industry}
                      onChange={(e) => setFormData({...formData, industry: e.target.value})}
                    >
                      <option value="">Select Industry</option>
                      <option value="Technology">Technology</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Finance">Finance</option>
                      <option value="Education">Education</option>
                      <option value="Retail">Retail</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Consulting">Consulting</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Design">Design</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="orgSize">Company Size</label>
                    <select
                      id="orgSize"
                      value={formData.size}
                      onChange={(e) => setFormData({...formData, size: e.target.value})}
                    >
                      <option value="">Select Size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="500+">500+ employees</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="subscriptionPlan">Subscription Plan *</label>
                    <select
                      id="subscriptionPlan"
                      value={formData.subscriptionPlan}
                      onChange={(e) => setFormData({...formData, subscriptionPlan: e.target.value as any})}
                    >
                      <option value="basic">Basic - $99/month</option>
                      <option value="professional">Professional - $299/month</option>
                      <option value="enterprise">Enterprise - Custom</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="billingCycle">Billing Cycle</label>
                    <select
                      id="billingCycle"
                      value={formData.billingCycle}
                      onChange={(e) => setFormData({...formData, billingCycle: e.target.value as any})}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly (Save 20%)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowAddOrg(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleAddOrganization}
                  disabled={!formData.name || !formData.email || !formData.adminUser}
                >
                  Add Organization
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Organization Modal */}
        {showEditOrg && selectedOrg && (
          <div className="modal-backdrop" onClick={() => setShowEditOrg(false)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Edit Organization</h3>
                <button className="modal-close" onClick={() => setShowEditOrg(false)}>
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="editOrgName">Organization Name *</label>
                    <input
                      id="editOrgName"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter organization name"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="editOrgEmail">Email Address *</label>
                    <input
                      id="editOrgEmail"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="organization@company.com"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="editOrgPhone">Phone Number</label>
                    <input
                      id="editOrgPhone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+1-555-0123"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="editAdminUser">Admin User Email *</label>
                    <input
                      id="editAdminUser"
                      type="email"
                      value={formData.adminUser}
                      onChange={(e) => setFormData({...formData, adminUser: e.target.value})}
                      placeholder="admin@company.com"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="editOrgAddress">Address</label>
                    <input
                      id="editOrgAddress"
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="123 Main Street"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="editOrgCity">City</label>
                    <input
                      id="editOrgCity"
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      placeholder="New York"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="editOrgCountry">Country</label>
                    <input
                      id="editOrgCountry"
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      placeholder="United States"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="editOrgIndustry">Industry</label>
                    <select
                      id="editOrgIndustry"
                      value={formData.industry}
                      onChange={(e) => setFormData({...formData, industry: e.target.value})}
                    >
                      <option value="">Select Industry</option>
                      <option value="Technology">Technology</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Finance">Finance</option>
                      <option value="Education">Education</option>
                      <option value="Retail">Retail</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Consulting">Consulting</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Design">Design</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="editOrgSize">Company Size</label>
                    <select
                      id="editOrgSize"
                      value={formData.size}
                      onChange={(e) => setFormData({...formData, size: e.target.value})}
                    >
                      <option value="">Select Size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="500+">500+ employees</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="editSubscriptionPlan">Subscription Plan *</label>
                    <select
                      id="editSubscriptionPlan"
                      value={formData.subscriptionPlan}
                      onChange={(e) => setFormData({...formData, subscriptionPlan: e.target.value as any})}
                    >
                      <option value="basic">Basic - $99/month</option>
                      <option value="professional">Professional - $299/month</option>
                      <option value="enterprise">Enterprise - Custom</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="editBillingCycle">Billing Cycle</label>
                    <select
                      id="editBillingCycle"
                      value={formData.billingCycle}
                      onChange={(e) => setFormData({...formData, billingCycle: e.target.value as any})}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly (Save 20%)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowEditOrg(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleEditOrganization}
                  disabled={!formData.name || !formData.email || !formData.adminUser}
                >
                  Update Organization
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
