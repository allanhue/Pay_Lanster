"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

interface Payment {
  id: string;
  organizationId: string;
  organizationName: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  paymentDate: string;
  dueDate: string;
  method: "bank_transfer" | "paypal" | "stripe" | "check" | "crypto";
  description: string;
  createdAt: string;
  transactionId?: string;
  failureReason?: string;
  processingFee?: number;
}

export default function PaymentsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterOrg, setFilterOrg] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
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
    loadPayments();
  }, [router]);

  const loadPayments = async () => {
    try {
      // Enhanced mock data with more realistic scenarios
      const mockPayments: Payment[] = [
        {
          id: "pay_001",
          organizationId: "org_001",
          organizationName: "Tech Corp",
          employeeId: "emp_001",
          employeeName: "John Doe",
          amount: 3500,
          currency: "USD",
          status: "completed",
          paymentDate: "2026-03-10",
          dueDate: "2026-03-10",
          method: "bank_transfer",
          description: "March 2026 Salary",
          createdAt: "2026-03-01T10:00:00Z",
          transactionId: "TXN_001234567890",
          processingFee: 15.50
        },
        {
          id: "pay_002",
          organizationId: "org_002",
          organizationName: "Marketing Agency",
          employeeId: "emp_002",
          employeeName: "Jane Smith",
          amount: 4200,
          currency: "USD",
          status: "processing",
          paymentDate: "",
          dueDate: "2026-03-15",
          method: "paypal",
          description: "March 2026 Salary",
          createdAt: "2026-03-01T10:00:00Z",
          processingFee: 42.00
        },
        {
          id: "pay_003",
          organizationId: "org_001",
          organizationName: "Tech Corp",
          employeeId: "emp_003",
          employeeName: "Mike Johnson",
          amount: 2800,
          currency: "USD",
          status: "failed",
          paymentDate: "",
          dueDate: "2026-03-12",
          method: "stripe",
          description: "March 2026 Salary",
          createdAt: "2026-03-01T10:00:00Z",
          failureReason: "Insufficient funds",
          processingFee: 28.00
        },
        {
          id: "pay_004",
          organizationId: "org_003",
          organizationName: "Design Studio",
          employeeId: "emp_004",
          employeeName: "Sarah Wilson",
          amount: 5100,
          currency: "USD",
          status: "pending",
          paymentDate: "",
          dueDate: "2026-03-20",
          method: "check",
          description: "March 2026 Salary",
          createdAt: "2026-03-01T10:00:00Z"
        },
        {
          id: "pay_005",
          organizationId: "org_002",
          organizationName: "Marketing Agency",
          employeeId: "emp_005",
          employeeName: "David Brown",
          amount: 3750,
          currency: "USD",
          status: "completed",
          paymentDate: "2026-03-08",
          dueDate: "2026-03-08",
          method: "crypto",
          description: "March 2026 Salary",
          createdAt: "2026-03-01T10:00:00Z",
          transactionId: "0x1234...5678",
          processingFee: 7.50
        },
        {
          id: "pay_006",
          organizationId: "org_001",
          organizationName: "Tech Corp",
          employeeId: "emp_006",
          employeeName: "Emily Davis",
          amount: 4500,
          currency: "USD",
          status: "cancelled",
          paymentDate: "",
          dueDate: "2026-03-14",
          method: "bank_transfer",
          description: "March 2026 Salary",
          createdAt: "2026-03-01T10:00:00Z",
          failureReason: "Employee terminated"
        }
      ];
      setPayments(mockPayments);
    } catch (error) {
      console.error("Failed to load payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = searchQuery === "" || 
      payment.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.organizationName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || payment.status === filterStatus;
    const matchesMethod = filterMethod === "all" || payment.method === filterMethod;
    const matchesOrg = filterOrg === "all" || payment.organizationId === filterOrg;

    // Date range filter
    let matchesDateRange = true;
    if (dateRange.start && dateRange.end) {
      const paymentDate = new Date(payment.dueDate);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      matchesDateRange = paymentDate >= startDate && paymentDate <= endDate;
    }

    return matchesSearch && matchesStatus && matchesMethod && matchesOrg && matchesDateRange;
  });

  const organizations = [...new Set(payments.map(p => ({ id: p.organizationId, name: p.organizationName })))];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "status-completed";
      case "processing": return "status-processing";
      case "pending": return "status-draft";
      case "failed": return "status-badge";
      case "cancelled": return "status-badge";
      default: return "";
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "bank_transfer":
        return (
          <svg viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <polyline points="9,22 9,12 15,12 15,22" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case "paypal":
        return (
          <svg viewBox="0 0 24 24">
            <path d="M7 4v16h4a4 4 0 004-4V8a4 4 0 00-4-4H7z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 10h2M11 14h2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case "stripe":
        return (
          <svg viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case "check":
        return (
          <svg viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <polyline points="14,2 14,8 20,8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" />
            <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case "crypto":
        return (
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 6v12M9 9h6M9 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      default:
        return null;
    }
  };

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const completedAmount = filteredPayments
    .filter(p => p.status === "completed")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const pendingAmount = filteredPayments
    .filter(p => p.status === "pending")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const failedAmount = filteredPayments
    .filter(p => p.status === "failed")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const totalFees = filteredPayments
    .filter(p => p.processingFee)
    .reduce((sum, payment) => sum + (payment.processingFee || 0), 0);

  const handleBulkAction = (action: string) => {
    console.log(`Bulk action: ${action}`, selectedPayments);
    // Implement bulk actions here
  };

  const togglePaymentSelection = (paymentId: string) => {
    setSelectedPayments(prev => 
      prev.includes(paymentId) 
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <div className="page-header">
          <h1>Payments</h1>
          <p>Manage and track all payment transactions across organizations</p>
        </div>

        {/* Enhanced Statistics Cards */}
        <div className="cards-grid four-col">
          <div className="card-metric card-metric-enhanced">
            <div className="metric-icon metric-icon-primary">
              <svg viewBox="0 0 24 24">
                <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 8h10M7 12h10M7 16h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="metric-content">
              <span className="metric-label">Total Payments</span>
              <span className="metric-value">${totalAmount.toLocaleString()}</span>
              <span className="metric-sublabel">{filteredPayments.length} transactions</span>
            </div>
          </div>
          
          <div className="card-metric card-metric-enhanced">
            <div className="metric-icon metric-icon-success">
              <svg viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <polyline points="22,4 12,14.01 9,11.01" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="metric-content">
              <span className="metric-label">Completed</span>
              <span className="metric-value">${completedAmount.toLocaleString()}</span>
              <span className="metric-sublabel">Successfully processed</span>
            </div>
          </div>
          
          <div className="card-metric card-metric-enhanced">
            <div className="metric-icon metric-icon-warning">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <polyline points="12,6 12,12 16,14" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="metric-content">
              <span className="metric-label">Pending</span>
              <span className="metric-value">${pendingAmount.toLocaleString()}</span>
              <span className="metric-sublabel">Awaiting processing</span>
            </div>
          </div>
          
          <div className="card-metric card-metric-enhanced">
            <div className="metric-icon metric-icon-danger">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="1.5" />
                <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="metric-content">
              <span className="metric-label">Failed</span>
              <span className="metric-value">${failedAmount.toLocaleString()}</span>
              <span className="metric-sublabel">Processing errors</span>
            </div>
          </div>
        </div>

        {/* Processing Fees Summary */}
        <div className="panel panel-elevated">
          <div className="panel-header">
            <h2>Processing Fees Summary</h2>
            <span className="fee-total">Total: ${totalFees.toFixed(2)}</span>
          </div>
          <div className="fee-breakdown">
            <div className="fee-item">
              <span className="fee-label">Average Fee per Transaction</span>
              <span className="fee-value">
                ${filteredPayments.length > 0 ? (totalFees / filteredPayments.length).toFixed(2) : '0.00'}
              </span>
            </div>
            <div className="fee-item">
              <span className="fee-label">Total Transactions with Fees</span>
              <span className="fee-value">
                {filteredPayments.filter(p => p.processingFee).length}
              </span>
            </div>
          </div>
        </div>

        {/* Enhanced Filters */}
        <div className="panel panel-elevated">
          <div className="panel-header">
            <h2>Payment Filters</h2>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setShowBulkActions(!showBulkActions)}
            >
              {showBulkActions ? 'Hide' : 'Show'} Bulk Actions
            </button>
          </div>
          <div className="filter-row">
            <div className="form-group">
              <label htmlFor="searchPayments">Search</label>
              <div className="search-input-wrapper">
                <svg viewBox="0 0 24 24" className="search-icon">
                  <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M21 21l-4.35-4.35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  id="searchPayments"
                  type="text"
                  placeholder="Search by employee, org, description, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="filterOrg">Organization</label>
              <select 
                id="filterOrg" 
                value={filterOrg} 
                onChange={(e) => setFilterOrg(e.target.value)}
              >
                <option value="all">All Organizations</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
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
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="filterMethod">Payment Method</label>
              <select 
                id="filterMethod" 
                value={filterMethod} 
                onChange={(e) => setFilterMethod(e.target.value)}
              >
                <option value="all">All Methods</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="paypal">PayPal</option>
                <option value="stripe">Stripe</option>
                <option value="check">Check</option>
                <option value="crypto">Cryptocurrency</option>
              </select>
            </div>
          </div>
          
          <div className="filter-row">
            <div className="form-group">
              <label htmlFor="dateRangeStart">Date Range</label>
              <input
                id="dateRangeStart"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="dateRangeEnd">to</label>
              <input
                id="dateRangeEnd"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearchQuery("");
                setFilterStatus("all");
                setFilterMethod("all");
                setFilterOrg("all");
                setDateRange({ start: "", end: "" });
              }}
            >
              Clear Filters
            </button>
          </div>

          {/* Bulk Actions */}
          {showBulkActions && (
            <div className="bulk-actions">
              <div className="bulk-actions-header">
                <h4>Bulk Actions ({selectedPayments.length} selected)</h4>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedPayments([])}
                >
                  Clear Selection
                </button>
              </div>
              <div className="bulk-actions-buttons">
                <button 
                  className="btn btn-success btn-sm"
                  onClick={() => handleBulkAction("process")}
                  disabled={selectedPayments.length === 0}
                >
                  Process Selected
                </button>
                <button 
                  className="btn btn-warning btn-sm"
                  onClick={() => handleBulkAction("retry")}
                  disabled={selectedPayments.length === 0}
                >
                  Retry Failed
                </button>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => handleBulkAction("cancel")}
                  disabled={selectedPayments.length === 0}
                >
                  Cancel Selected
                </button>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => handleBulkAction("export")}
                >
                  Export Selected
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Payments Table */}
        <div className="panel panel-elevated">
          <div className="panel-header">
            <h2>Payment Transactions</h2>
            <div className="table-actions">
              <button className="btn btn-primary btn-sm">
                Export All
              </button>
              <button className="btn btn-secondary btn-sm">
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <p>Loading payments...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" className="empty-icon">
                <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 8h10M7 12h10M7 16h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p>No payments found matching your criteria.</p>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("all");
                  setFilterMethod("all");
                  setFilterOrg("all");
                  setDateRange({ start: "", end: "" });
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table payments-table">
                <thead>
                  <tr>
                    {showBulkActions && (
                      <th className="checkbox-column">
                        <input
                          type="checkbox"
                          checked={selectedPayments.length === filteredPayments.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPayments(filteredPayments.map(p => p.id));
                            } else {
                              setSelectedPayments([]);
                            }
                          }}
                        />
                      </th>
                    )}
                    <th>Payment ID</th>
                    <th>Organization</th>
                    <th>Employee</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Payment Date</th>
                    <th>Fee</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className={selectedPayments.includes(payment.id) ? 'selected' : ''}>
                      {showBulkActions && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedPayments.includes(payment.id)}
                            onChange={() => togglePaymentSelection(payment.id)}
                          />
                        </td>
                      )}
                      <td>
                        <div className="payment-id-cell">
                          <span className="payment-id">{payment.id}</span>
                          {payment.transactionId && (
                            <span className="transaction-id">TXN: {payment.transactionId}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="organization-badge">{payment.organizationName}</span>
                      </td>
                      <td>
                        <div className="employee-info">
                          <div className="employee-avatar">
                            {payment.employeeName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <span className="employee-name">{payment.employeeName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="payment-amount-cell">
                          <span className="payment-amount">${payment.amount.toLocaleString()}</span>
                          {payment.processingFee && (
                            <span className="fee-indicator">+${payment.processingFee}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="payment-method">
                          <span className="method-icon">
                            {getMethodIcon(payment.method)}
                          </span>
                          <span className="method-name">
                            {payment.method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusColor(payment.status)}`}>
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </span>
                        {payment.failureReason && (
                          <div className="failure-reason">{payment.failureReason}</div>
                        )}
                      </td>
                      <td>
                        <span className="date">{new Date(payment.dueDate).toLocaleDateString()}</span>
                      </td>
                      <td>
                        <span className="date">
                          {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="fee-amount">
                          {payment.processingFee ? `$${payment.processingFee.toFixed(2)}` : '—'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="action-btn edit-btn"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowDetails(true);
                            }}
                            title="View Details"
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          </button>
                          {payment.status === "failed" && (
                            <button className="action-btn retry-btn" title="Retry Payment">
                              <svg viewBox="0 0 24 24">
                                <polyline points="23,4 23,10 17,10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Enhanced Payment Details Modal */}
        {showDetails && selectedPayment && (
          <div className="modal-backdrop" onClick={() => setShowDetails(false)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Payment Details</h3>
                <button className="modal-close" onClick={() => setShowDetails(false)}>
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <div className="payment-details-grid">
                  <div className="detail-section">
                    <h4>Payment Information</h4>
                    <div className="detail-row">
                      <span className="detail-label">Payment ID:</span>
                      <span className="detail-value">{selectedPayment.id}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Transaction ID:</span>
                      <span className="detail-value">
                        {selectedPayment.transactionId || 'Not available'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Amount:</span>
                      <span className="detail-value payment-amount">
                        ${selectedPayment.amount.toLocaleString()} {selectedPayment.currency}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Processing Fee:</span>
                      <span className="detail-value">
                        {selectedPayment.processingFee ? `$${selectedPayment.processingFee.toFixed(2)}` : 'No fee'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Total Amount:</span>
                      <span className="detail-value payment-amount">
                        ${(selectedPayment.amount + (selectedPayment.processingFee || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h4>Employee Information</h4>
                    <div className="detail-row">
                      <span className="detail-label">Employee Name:</span>
                      <span className="detail-value">{selectedPayment.employeeName}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Organization:</span>
                      <span className="detail-value">{selectedPayment.organizationName}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Description:</span>
                      <span className="detail-value">{selectedPayment.description}</span>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h4>Status & Timeline</h4>
                    <div className="detail-row">
                      <span className="detail-label">Status:</span>
                      <span className={`status-badge ${getStatusColor(selectedPayment.status)}`}>
                        {selectedPayment.status.charAt(0).toUpperCase() + selectedPayment.status.slice(1)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Payment Method:</span>
                      <span className="detail-value">
                        {selectedPayment.method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Due Date:</span>
                      <span className="detail-value">{new Date(selectedPayment.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Payment Date:</span>
                      <span className="detail-value">
                        {selectedPayment.paymentDate 
                          ? new Date(selectedPayment.paymentDate).toLocaleDateString() 
                          : 'Not processed yet'
                        }
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Created:</span>
                      <span className="detail-value">{new Date(selectedPayment.createdAt).toLocaleString()}</span>
                    </div>
                    {selectedPayment.failureReason && (
                      <div className="detail-row">
                        <span className="detail-label">Failure Reason:</span>
                        <span className="detail-value failure-reason">{selectedPayment.failureReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-actions">
                  {selectedPayment.status === "failed" && (
                    <button className="btn btn-warning">
                      Retry Payment
                    </button>
                  )}
                  {selectedPayment.status === "pending" && (
                    <>
                      <button className="btn btn-success">
                        Process Payment
                      </button>
                      <button className="btn btn-danger">
                        Cancel Payment
                    </button>
                    </>
                  )}
                  <button className="btn btn-secondary">
                    Download Receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}