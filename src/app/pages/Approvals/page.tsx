"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { addNotification } from "@/app/lib/notifications";
import { api, type ApprovalItem } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

export default function ApprovalsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const router = useRouter();

  const refreshApprovals = async (orgId: string, silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const data = await api.listApprovals(orgId);
      setApprovals(Array.isArray(data) ? data : []);
      setLastSync(new Date().toLocaleTimeString());
    } catch {
      // Keep last successful data
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  const setStatus = async (id: string, status: ApprovalItem["status"]) => {
    if (!session?.orgId) return;
    try {
      const updated = await api.updateApprovalStatus({ orgId: session.orgId, id, status });
      setApprovals((prev) => prev.map((item) => (item.id === id ? updated : item)));
      addNotification({
        title: `Approval ${status}`,
        detail: `${updated.type.toUpperCase()} ${updated.reference} • ${updated.owner}`,
        tag: "approval",
        link: "/pages/Approvals",
      });
    } catch {
      // ignore errors for now
    }
  };

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
    void refreshApprovals(current.orgId);
  }, [router]);

  useEffect(() => {
    if (!session?.orgId || !autoRefresh) return;
    const timer = setInterval(() => refreshApprovals(session.orgId, true), 20000);
    return () => clearInterval(timer);
  }, [session?.orgId, autoRefresh]);

  const filteredApprovals = useMemo(() => {
    return approvals.filter((item) => {
      const matchesSearch =
        searchQuery === "" ||
        item.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.owner.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "all" || item.status === filterStatus;
      const matchesType = filterType === "all" || item.type === filterType;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [approvals, searchQuery, filterStatus, filterType]);

  const summary = useMemo(
    () => ({
      pending: approvals.filter((item) => item.status === "pending").length,
      approved: approvals.filter((item) => item.status === "approved").length,
      rejected: approvals.filter((item) => item.status === "rejected").length,
    }),
    [approvals]
  );

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide">
        <div className="page-header">
          <h1>Approval Queue</h1>
          <p>Approve payruns and payslips before payroll release.</p>
        </div>

        <div className="cards-grid three-col">
          <article className="card card-metric">
            <span className="metric-label">Pending</span>
            <span className="metric-value">{summary.pending}</span>
            <span className="metric-sublabel">Awaiting decision</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Approved</span>
            <span className="metric-value">{summary.approved}</span>
            <span className="metric-sublabel">Ready to proceed</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Rejected</span>
            <span className="metric-value">{summary.rejected}</span>
            <span className="metric-sublabel">Needs changes</span>
          </article>
        </div>

        <article className="panel panel-elevated">
          <div className="panel-header">
            <div>
              <h2>Review Items</h2>
              <p>Filter by type, status, or reference.</p>
            </div>
            <div className="panel-meta">
              <span className="status-pill">
                {autoRefresh ? "Live refresh" : "Manual refresh"}
              </span>
              <span className="meta-text">Last sync: {lastSync || "—"}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => session?.orgId && refreshApprovals(session.orgId)}
                disabled={isSyncing}
              >
                {isSyncing ? "Syncing..." : "Sync now"}
              </button>
            </div>
          </div>
          <div className="filter-row">
            <div className="form-group">
              <label htmlFor="approvalSearch">Search</label>
              <input
                id="approvalSearch"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by reference or owner"
              />
            </div>
            <div className="form-group">
              <label htmlFor="approvalType">Type</label>
              <select id="approvalType" value={filterType} onChange={(event) => setFilterType(event.target.value)}>
                <option value="all">All types</option>
                <option value="payrun">Payrun</option>
                <option value="payslip">Payslip</option>
                <option value="benefit">Benefit</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="approvalStatus">Status</label>
              <select id="approvalStatus" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="form-group form-group-inline">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <span className="switch-track" />
              </label>
              <span className="switch-label">Auto refresh</span>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Owner</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApprovals.map((approval) => (
                <tr key={approval.id}>
                  <td>{approval.id}</td>
                  <td>{approval.type}</td>
                  <td>{approval.reference}</td>
                  <td>{approval.owner}</td>
                  <td>{approval.requestedOn}</td>
                  <td>
                    <span className={`status-badge status-${approval.status}`}>{approval.status}</span>
                  </td>
                  <td>
                    <div className="inline-actions">
                      <button className="secondary" onClick={() => setStatus(approval.id, "approved")} type="button">
                        Approve
                      </button>
                      <button className="danger" onClick={() => setStatus(approval.id, "rejected")} type="button">
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </article>
      </section>
    </main>
  );
}
