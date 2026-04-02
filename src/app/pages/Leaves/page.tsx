"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import ModuleActions from "@/app/components/ModuleActions";
import { api, type LeaveRequest, type LeaveType, type PayrollEmployee } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

// ── Types ──────────────────────────────────────────────────────────────────

type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
type LeaveBalance = {
  employeeId: string;
  employeeName: string;
  department: string;
  items: { typeCode: string; label: string; entitled: number; used: number; remaining: number }[];
};

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_META: Record<LeaveStatus, { label: string; bg: string; color: string }> = {
  pending:   { label: "Pending",   bg: "rgba(245,158,11,0.1)",   color: "#b45309" },
  approved:  { label: "Approved",  bg: "var(--accent-subtle)",   color: "var(--accent)" },
  rejected:  { label: "Rejected",  bg: "rgba(239,68,68,0.1)",    color: "#dc2626" },
  cancelled: { label: "Cancelled", bg: "rgba(107,114,128,0.1)",  color: "#6b7280" },
};




function calcBusinessDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  if (e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}


function StepBadge({ n }: { n: number }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: "1.5rem", height: "1.5rem", borderRadius: "50%",
      background: "var(--accent)", color: "#fff",
      fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
    }}>{n}</span>
  );
}

function SectionLabel({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
      <StepBadge n={step} />
      <div>
        <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.1rem" }}>{subtitle}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  const meta = STATUS_META[status];
  return (
    <span style={{ display: "inline-block", fontSize: "0.72rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "1rem", background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

function TypeBadge({ label, color, accentColor }: { label: string; color: string; accentColor: string }) {
  return (
    <span style={{ display: "inline-block", fontSize: "0.72rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "0.25rem", background: color, color: accentColor }}>
      {label}
    </span>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value?: string | number; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border, #f3f4f6)", gap: "0.5rem" }}>
      <span style={{ fontSize: "0.8125rem", opacity: 0.55, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "0.8125rem", fontWeight: 500, textAlign: "right", fontFamily: mono ? "monospace" : "inherit" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function LeavePage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const router = useRouter();

  // Data
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<"overview" | "requests" | "balances" | "policies">("overview");

  // Filters
  const [filterStatus, setFilterStatus] = useState<"all" | LeaveStatus>("all");
  const [filterType, setFilterType] = useState<"all" | string>("all");
  const [filterDept, setFilterDept] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"appliedOn" | "startDate" | "days">("appliedOn");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modals
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [showDetail, setShowDetail] = useState<LeaveRequest | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<LeaveRequest | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<LeaveRequest | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);

  // New request form
  const [formEmployee, setFormEmployee] = useState("");
  const [formType, setFormType] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Leave type form
  const [typeCode, setTypeCode] = useState("");
  const [typeLabel, setTypeLabel] = useState("");
  const [typeDays, setTypeDays] = useState("0");
  const [typeRequiresDoc, setTypeRequiresDoc] = useState(false);
  const [typeColor, setTypeColor] = useState("var(--accent-subtle)");
  const [typeAccent, setTypeAccent] = useState("var(--accent)");
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeError, setTypeError] = useState("");

  // Review form
  const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected">("approved");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  // Alerts
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState<"success" | "error">("success");

  useEffect(() => {
    const current = readSession();
    if (!current) { router.replace("/auth/login"); return; }
    if (current.role !== "org_admin") { router.replace("/system_admin/Dasboard"); return; }
    setSession(current);

    if (!current.orgId) return;

    Promise.all([
      api.listEmployees(current.orgId),
      api.listLeaveTypes(current.orgId),
      api.listLeaveRequests(current.orgId),
    ])
      .then(([empData, typeData, requestData]) => {
        setEmployees(Array.isArray(empData) ? empData : []);
        const types = Array.isArray(typeData) ? typeData : [];
        setLeaveTypes(types);
        setRequests(Array.isArray(requestData) ? requestData : []);
        setFormType((prev) => prev || (types[0]?.code ?? ""));
      })
      .catch(() => {
        setEmployees([]);
        setLeaveTypes([]);
        setRequests([]);
      });
  }, [router]);

  const showAlert = (msg: string, type: "success" | "error" = "success") => {
    setAlertMsg(msg); setAlertType(type);
    setTimeout(() => setAlertMsg(""), 4000);
  };

  const policyByCode = useMemo(() => new Map(leaveTypes.map((p) => [p.code, p])), [leaveTypes]);
  const getPolicy = (code: string) => policyByCode.get(code);
  const getTypeBadge = (code: string, label?: string) => {
    const policy = getPolicy(code);
    return {
      label: policy?.label ?? label ?? code,
      color: policy?.color ?? "var(--muted, #f3f4f6)",
      accentColor: policy?.accentColor ?? "var(--muted-text, #6b7280)",
    };
  };

  // ── Derived stats ──

  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(r => r.status === "pending").length;
    const approved = requests.filter(r => r.status === "approved").length;
    const rejected = requests.filter(r => r.status === "rejected").length;
    const onLeaveToday = requests.filter(r => {
      const today = new Date().toISOString().slice(0, 10);
      return r.status === "approved" && r.startDate <= today && r.endDate >= today;
    }).length;
    const totalDaysApproved = requests.filter(r => r.status === "approved").reduce((s, r) => s + r.days, 0);
    return { total, pending, approved, rejected, onLeaveToday, totalDaysApproved };
  }, [requests]);

  const departments = useMemo(() => {
    return [...new Set(requests.map(r => r.department))].sort();
  }, [requests]);

  const balances = useMemo<LeaveBalance[]>(() => {
    if (leaveTypes.length === 0 || employees.length === 0) return [];
    const approved = requests.filter((r) => r.status === "approved");
    return employees.map((emp) => {
      const items = leaveTypes.map((type) => {
        const used = approved
          .filter((r) => r.employeeId === emp.id && r.typeCode === type.code)
          .reduce((sum, r) => sum + r.days, 0);
        const entitled = type.defaultDays ?? 0;
        return {
          typeCode: type.code,
          label: type.label,
          entitled,
          used,
          remaining: Math.max(entitled - used, 0),
        };
      });
      return {
        employeeId: emp.id,
        employeeName: emp.fullName,
        department: emp.department,
        items,
      };
    });
  }, [employees, leaveTypes, requests]);

  const filteredRequests = useMemo(() => {
    let list = requests.filter(r => {
      const matchSearch = !searchQuery ||
        r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch &&
        (filterStatus === "all" || r.status === filterStatus) &&
        (filterType === "all" || r.typeCode === filterType) &&
        (filterDept === "all" || r.department === filterDept);
    });
    list.sort((a, b) => {
      const aVal = a[sortBy]; const bVal = b[sortBy];
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [requests, searchQuery, filterStatus, filterType, filterDept, sortBy, sortOrder]);

  const hasFilters = searchQuery || filterStatus !== "all" || filterType !== "all" || filterDept !== "all";

  const formDays = useMemo(() => calcBusinessDays(formStart, formEnd), [formStart, formEnd]);

  // ── Actions ──

  const resetRequestForm = () => {
    setFormEmployee("");
    setFormType(leaveTypes[0]?.code ?? "");
    setFormStart("");
    setFormEnd("");
    setFormReason("");
    setFormError("");
    setEditingRequest(null);
  };

  const openNewRequestForm = () => {
    resetRequestForm();
    setShowRequestForm(true);
  };

  const openEditRequestForm = (req: LeaveRequest) => {
    setEditingRequest(req);
    setFormEmployee(req.employeeId);
    setFormType(req.typeCode);
    setFormStart(req.startDate);
    setFormEnd(req.endDate);
    setFormReason(req.reason);
    setFormError("");
    setShowRequestForm(true);
  };

  const handleSubmitRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.orgId) return;
    if (!formEmployee || !formStart || !formEnd || !formReason || !formType) {
      setFormError("Please fill in all required fields.");
      return;
    }
    if (formDays <= 0) { setFormError("End date must be after start date."); return; }
    const emp = employees.find(e => e.id === formEmployee);
    if (!emp) { setFormError("Select a valid employee."); return; }
    const policy = getPolicy(formType);
    if (!policy) { setFormError("Select a valid leave type."); return; }
    setFormSaving(true); setFormError("");
    const payload = {
      orgId: session.orgId,
      employeeId: emp.id,
      employeeName: emp.fullName,
      department: emp.department,
      typeCode: formType,
      typeLabel: policy.label,
      startDate: formStart,
      endDate: formEnd,
      days: formDays,
      reason: formReason,
      status: editingRequest?.status ?? "pending",
      appliedOn: editingRequest?.appliedOn ?? new Date().toISOString().slice(0, 10),
      reviewedBy: editingRequest?.reviewedBy ?? "",
      reviewedOn: editingRequest?.reviewedOn ?? "",
      reviewNote: editingRequest?.reviewNote ?? "",
    };
    try {
      if (editingRequest) {
        const updated = await api.updateLeaveRequest({ id: editingRequest.id, ...payload });
        setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
        showAlert(`Leave request ${updated.id} updated successfully.`);
      } else {
        const created = await api.createLeaveRequest(payload);
        setRequests(prev => [created, ...prev]);
        showAlert(`Leave request ${created.id} submitted successfully.`);
      }
      setShowRequestForm(false);
      resetRequestForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save leave request.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleReview = async () => {
    if (!showReviewModal || !session?.orgId) return;
    setReviewSaving(true);
    const updatedRequest: LeaveRequest = {
      ...showReviewModal,
      orgId: session.orgId,
      status: reviewDecision,
      reviewedBy: session.name,
      reviewedOn: new Date().toISOString().slice(0, 10),
      reviewNote,
    };
    try {
      const updated = await api.updateLeaveRequest(updatedRequest);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      showAlert(`Request ${updated.id} ${reviewDecision}.`);
      setShowReviewModal(null);
      setReviewNote("");
    } finally {
      setReviewSaving(false);
    }
  };

  const handleCancel = async (req: LeaveRequest) => {
    if (!session?.orgId) return;
    try {
      const updated = await api.updateLeaveRequest({
        ...req,
        orgId: session.orgId,
        status: "cancelled",
      });
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      showAlert(`Leave request ${updated.id} cancelled.`);
    } finally {
      setShowCancelConfirm(null);
      setShowDetail(null);
    }
  };

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortOrder(o => o === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortOrder("desc"); }
  };

  const resetTypeForm = () => {
    setTypeCode("");
    setTypeLabel("");
    setTypeDays("0");
    setTypeRequiresDoc(false);
    setTypeColor("var(--accent-subtle)");
    setTypeAccent("var(--accent)");
    setTypeError("");
    setEditingType(null);
  };

  const openNewTypeModal = () => {
    resetTypeForm();
    setShowTypeModal(true);
  };

  const openEditTypeModal = (type: LeaveType) => {
    setEditingType(type);
    setTypeCode(type.code);
    setTypeLabel(type.label);
    setTypeDays(String(type.defaultDays ?? 0));
    setTypeRequiresDoc(Boolean(type.requiresDoc));
    setTypeColor(type.color || "var(--accent-subtle)");
    setTypeAccent(type.accentColor || "var(--accent)");
    setTypeError("");
    setShowTypeModal(true);
  };

  const normalizeCode = (input: string) =>
    input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  const handleSaveType = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.orgId) return;
    const codeValue = normalizeCode(typeCode || typeLabel);
    if (!typeLabel.trim()) { setTypeError("Type name is required."); return; }
    if (!codeValue) { setTypeError("Type code is required."); return; }
    const days = Number(typeDays);
    if (Number.isNaN(days) || days < 0) { setTypeError("Default days must be 0 or more."); return; }
    setTypeSaving(true);
    setTypeError("");
    try {
      if (editingType) {
        const updated = await api.updateLeaveType({
          ...editingType,
          orgId: session.orgId,
          code: editingType.code,
          label: typeLabel.trim(),
          defaultDays: days,
          requiresDoc: typeRequiresDoc,
          color: typeColor,
          accentColor: typeAccent,
          status: editingType.status || "active",
        });
        setLeaveTypes(prev => prev.map(t => t.id === updated.id ? updated : t));
        showAlert(`Leave type ${updated.label} updated.`);
      } else {
        const created = await api.createLeaveType({
          orgId: session.orgId,
          code: codeValue,
          label: typeLabel.trim(),
          defaultDays: days,
          requiresDoc: typeRequiresDoc,
          color: typeColor,
          accentColor: typeAccent,
          status: "active",
        });
        setLeaveTypes(prev => [created, ...prev]);
        if (!formType) setFormType(created.code);
        showAlert(`Leave type ${created.label} added.`);
      }
      setShowTypeModal(false);
      resetTypeForm();
    } catch (err) {
      setTypeError(err instanceof Error ? err.message : "Failed to save leave type.");
    } finally {
      setTypeSaving(false);
    }
  };

  if (!session) return <main className="centered">Loading…</main>;

  // ── Render ──

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide" style={{ padding: "6rem 1.5rem" }}>

        {/* ── Page Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Leave Management</h1>
            <p style={{ fontSize: "0.875rem", opacity: 0.6, margin: 0 }}>Review, approve, and track employee leave requests.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <ModuleActions />
            <button className="btn btn-primary btn-sm" type="button" onClick={openNewRequestForm}>
              + New Request
            </button>
          </div>
        </div>

        {/* Alert */}
        {alertMsg && (
          <div className={`alert alert-${alertType}`} style={{ marginBottom: "1.25rem", padding: "0.875rem 1.25rem", borderRadius: "0.5rem" }}>
            {alertMsg}
          </div>
        )}

        {/* ── Metric cards ── */}
        <div className="cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1.25rem", marginBottom: "1.75rem" }}>
          {[
            { label: "Total Requests", value: stats.total, sub: "All time" },
            { label: "Pending Review", value: stats.pending, sub: "Awaiting decision", highlight: stats.pending > 0 },
            { label: "Approved", value: stats.approved, sub: "This year" },
            { label: "On Leave Today", value: stats.onLeaveToday, sub: "Active absences" },
            { label: "Days Granted", value: stats.totalDaysApproved, sub: "Approved days YTD" },
          ].map(card => (
            <article key={card.label} className="card card-metric" style={{
              padding: "1.25rem 1.5rem",
              ...(card.highlight ? { border: "1.5px solid var(--accent)", background: "var(--accent-subtle)" } : {}),
            }}>
              <span className="metric-label">{card.label}</span>
              <strong className="metric-value" style={card.highlight ? { color: "var(--accent)" } : {}}>{card.value}</strong>
              <span className="metric-sublabel">{card.sub}</span>
            </article>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="tabs" style={{ marginBottom: "1.75rem" }}>
          {([
            { key: "overview",  label: "Overview",  icon: <path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z" fill="none" stroke="currentColor" strokeWidth="1.5" /> },
            { key: "requests",  label: "Requests",  icon: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke="currentColor" strokeWidth="1.5"/><polyline points="14,2 14,8 20,8" fill="none" stroke="currentColor" strokeWidth="1.5"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5"/></> },
            { key: "balances",  label: "Balances",  icon: <><rect x="3" y="3" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" rx="1"/><rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" rx="1"/><rect x="3" y="14" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" rx="1"/><rect x="14" y="14" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" rx="1"/></> },
            { key: "policies",  label: "Policies",  icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" strokeWidth="1.5"/></> },
          ] as const).map(tab => (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">{tab.icon}</svg>
              {tab.label}
              {tab.key === "requests" && stats.pending > 0 && (
                <span style={{ marginLeft: "0.35rem", fontSize: "0.65rem", fontWeight: 700, background: "var(--accent)", color: "#fff", borderRadius: "1rem", padding: "0.1rem 0.45rem" }}>
                  {stats.pending}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════ OVERVIEW TAB ══════════ */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Pending requests quick-view */}
            <div className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <div>
                  <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.15rem" }}>Pending Approvals</h2>
                  <p style={{ fontSize: "0.8125rem", opacity: 0.55, margin: 0 }}>{stats.pending} request{stats.pending !== 1 ? "s" : ""} awaiting review</p>
                </div>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setActiveTab("requests")}>View all</button>
              </div>
              {requests.filter(r => r.status === "pending").length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", opacity: 0.4, fontSize: "0.875rem" }}>No pending requests</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {requests.filter(r => r.status === "pending").map(req => (
                    <div key={req.id} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1rem", borderRadius: "0.5rem", border: "1px solid var(--border, #e5e7eb)", background: "var(--surface, #f9fafb)", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.15rem" }}>{req.employeeName}</div>
                        <div style={{ fontSize: "0.75rem", opacity: 0.55 }}>{req.department} · Applied {fmtDate(req.appliedOn)}</div>
                      </div>
                      {(() => {
                        const badge = getTypeBadge(req.typeCode, req.typeLabel);
                        return <TypeBadge label={badge.label} color={badge.color} accentColor={badge.accentColor} />;
                      })()}
                      <div style={{ fontSize: "0.8125rem", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {fmtDate(req.startDate)} → {fmtDate(req.endDate)}
                        <span style={{ marginLeft: "0.5rem", opacity: 0.5 }}>({req.days}d)</span>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="btn btn-primary btn-sm" type="button"
                          style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem" }}
                          onClick={() => { setShowReviewModal(req); setReviewDecision("approved"); setReviewNote(""); }}>
                          Approve
                        </button>
                        <button className="btn btn-secondary btn-sm" type="button"
                          style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem" }}
                          onClick={() => { setShowReviewModal(req); setReviewDecision("rejected"); setReviewNote(""); }}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* On leave today */}
            <div className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>
              <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.15rem" }}>On Leave Today</h2>
                <p style={{ fontSize: "0.8125rem", opacity: 0.55, margin: 0 }}>
                  {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              {(() => {
                const today = new Date().toISOString().slice(0, 10);
                const onLeave = requests.filter(r => r.status === "approved" && r.startDate <= today && r.endDate >= today);
                return onLeave.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", opacity: 0.4, fontSize: "0.875rem" }}>Nobody is on leave today</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
                    {onLeave.map(r => {
                      const policy = getPolicy(r.typeCode);
                      const badge = getTypeBadge(r.typeCode, r.typeLabel);
                      return (
                        <div key={r.id} style={{ padding: "0.875rem 1rem", borderRadius: "0.5rem", border: `1.5px solid ${(policy?.accentColor ?? badge.accentColor)}22`, background: policy?.color ?? badge.color }}>
                          <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.2rem" }}>{r.employeeName}</div>
                          <div style={{ fontSize: "0.75rem", opacity: 0.6, marginBottom: "0.375rem" }}>{r.department}</div>
                          <TypeBadge label={badge.label} color={badge.color} accentColor={badge.accentColor} />
                          <div style={{ fontSize: "0.72rem", opacity: 0.55, marginTop: "0.375rem" }}>Returns {fmtDate(r.endDate)}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Leave type breakdown */}
            <div className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>
              <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.15rem" }}>Leave Breakdown</h2>
                <p style={{ fontSize: "0.8125rem", opacity: 0.55, margin: 0 }}>Approved requests by type this year</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.875rem" }}>
                {leaveTypes.map(p => {
                  const count = requests.filter(r => r.typeCode === p.code && r.status === "approved").length;
                  const days = requests.filter(r => r.typeCode === p.code && r.status === "approved").reduce((s, r) => s + r.days, 0);
                  return (
                    <div key={p.code} style={{ padding: "1rem 1.125rem", borderRadius: "0.5rem", background: p.color, border: `1px solid ${p.accentColor}22` }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: p.accentColor, marginBottom: "0.375rem" }}>{p.label}</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>{count}</div>
                      <div style={{ fontSize: "0.72rem", opacity: 0.6 }}>{days} day{days !== 1 ? "s" : ""} taken</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ REQUESTS TAB ══════════ */}
        {activeTab === "requests" && (
          <div className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>
            {/* Header + search */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.15rem" }}>All Leave Requests</h2>
                <p style={{ fontSize: "0.8125rem", opacity: 0.55, margin: 0 }}>
                  {filteredRequests.length} of {requests.length} request{requests.length !== 1 ? "s" : ""}
                  {hasFilters ? " — filtered" : ""}
                </p>
              </div>
              <div style={{ position: "relative", minWidth: "220px" }}>
                <svg viewBox="0 0 24 24" style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", width: "0.875rem", height: "0.875rem", opacity: 0.4, pointerEvents: "none" }}>
                  <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M21 21l-4.35-4.35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input type="text" placeholder="Search employee, ID…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: "2rem", paddingRight: "0.875rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontSize: "0.8125rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Filter row */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
              {(["all", "pending", "approved", "rejected", "cancelled"] as const).map(s => (
                <button key={s} type="button"
                  onClick={() => setFilterStatus(s)}
                  style={{
                    fontSize: "0.75rem", fontWeight: 600, padding: "0.35rem 0.75rem",
                    borderRadius: "1rem", border: "1.5px solid",
                    borderColor: filterStatus === s ? "var(--accent)" : "var(--border, #e5e7eb)",
                    background: filterStatus === s ? "var(--accent-subtle)" : "transparent",
                    color: filterStatus === s ? "var(--accent)" : "inherit",
                    cursor: "pointer",
                  }}>
                  {s === "all" ? "All" : STATUS_META[s].label}
                  {s !== "all" && (
                    <span style={{ marginLeft: "0.3rem", opacity: 0.6 }}>
                      ({requests.filter(r => r.status === s).length})
                    </span>
                  )}
                </button>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
                <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
                  style={{ fontSize: "0.8125rem", padding: "0.4rem 0.625rem", borderRadius: "0.35rem", border: "1px solid var(--border, #d1d5db)", background: "var(--surface, #fff)" }}>
                  <option value="all">All Types</option>
                  {leaveTypes.map(p => <option key={p.id} value={p.code}>{p.label}</option>)}
                </select>
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                  style={{ fontSize: "0.8125rem", padding: "0.4rem 0.625rem", borderRadius: "0.35rem", border: "1px solid var(--border, #d1d5db)", background: "var(--surface, #fff)" }}>
                  <option value="all">All Depts</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {hasFilters && (
                  <button className="btn btn-secondary btn-sm" type="button"
                    style={{ fontSize: "0.8125rem" }}
                    onClick={() => { setSearchQuery(""); setFilterStatus("all"); setFilterType("all"); setFilterDept("all"); }}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            {filteredRequests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", opacity: 0.4, fontSize: "0.875rem" }}>No requests match your filters.</div>
            ) : (
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "left" }}>ID</th>
                    <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "left" }}>Employee</th>
                    <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "left" }}>Type</th>
                    <th onClick={() => handleSort("startDate")} style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "left", cursor: "pointer" }}>
                      Dates {sortBy === "startDate" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th onClick={() => handleSort("days")} style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "center", cursor: "pointer" }}>
                      Days {sortBy === "days" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th onClick={() => handleSort("appliedOn")} style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "left", cursor: "pointer" }}>
                      Applied {sortBy === "appliedOn" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "left" }}>Status</th>
                    <th style={{ padding: "0.625rem 0.875rem", width: "2.5rem" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map(req => (
                    <tr key={req.id} className="clickable-row" style={{ cursor: "pointer" }}
                      onClick={() => setShowDetail(req)}>
                      <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.75rem", fontFamily: "monospace", fontWeight: 600 }}>{req.id}</td>
                      <td style={{ padding: "0.75rem 0.875rem" }}>
                        <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{req.employeeName}</div>
                        <div style={{ fontSize: "0.72rem", opacity: 0.5 }}>{req.department}</div>
                      </td>
                      <td style={{ padding: "0.75rem 0.875rem" }}>
                        {(() => {
                          const badge = getTypeBadge(req.typeCode, req.typeLabel);
                          return <TypeBadge label={badge.label} color={badge.color} accentColor={badge.accentColor} />;
                        })()}
                      </td>
                      <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.8125rem" }}>
                        {fmtDate(req.startDate)} → {fmtDate(req.endDate)}
                      </td>
                      <td style={{ padding: "0.75rem 0.875rem", textAlign: "center", fontSize: "0.875rem", fontWeight: 600 }}>{req.days}</td>
                      <td style={{ padding: "0.75rem 0.875rem", fontSize: "0.8125rem", opacity: 0.7 }}>{fmtDate(req.appliedOn)}</td>
                      <td style={{ padding: "0.75rem 0.875rem" }}><StatusBadge status={req.status} /></td>
                      <td style={{ padding: "0.75rem 0.875rem" }} className="action-cell">
                        <button className="action-menu-btn" type="button"
                          onClick={e => { e.stopPropagation(); setActionMenu(actionMenu === req.id ? null : req.id); }}>
                          <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="1.6" fill="currentColor" />
                            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                            <circle cx="12" cy="19" r="1.6" fill="currentColor" />
                          </svg>
                        </button>
                        {actionMenu === req.id && (
                          <>
                            <button className="popover-backdrop" type="button" onClick={() => setActionMenu(null)} />
                            <div className="action-popover">
                              <button className="action-popover-item" type="button"
                                onClick={() => { setShowDetail(req); setActionMenu(null); }}>View details</button>
                              {req.status === "pending" && (
                                <>
                                  <button className="action-popover-item" type="button"
                                    onClick={() => { openEditRequestForm(req); setActionMenu(null); }}>
                                    Edit request
                                  </button>
                                  <button className="action-popover-item" type="button"
                                    onClick={() => { setShowReviewModal(req); setReviewDecision("approved"); setReviewNote(""); setActionMenu(null); }}>
                                    Approve
                                  </button>
                                  <button className="action-popover-item" type="button"
                                    onClick={() => { setShowReviewModal(req); setReviewDecision("rejected"); setReviewNote(""); setActionMenu(null); }}>
                                    Reject
                                  </button>
                                </>
                              )}
                              {(req.status === "pending" || req.status === "approved") && (
                                <button className="action-popover-item danger" type="button"
                                  onClick={() => { setShowCancelConfirm(req); setActionMenu(null); }}>
                                  Cancel request
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ══════════ BALANCES TAB ══════════ */}
        {activeTab === "balances" && (
          <div className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>
            <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
              <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.15rem" }}>Leave Balances</h2>
              <p style={{ fontSize: "0.8125rem", opacity: 0.55, margin: 0 }}>Remaining entitlements per employee for the current year</p>
            </div>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "left" }}>Employee</th>
                  {leaveTypes.map((t) => (
                    <th key={t.code} colSpan={3} style={{ padding: "0.625rem 0.875rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.55, textAlign: "center", borderLeft: "1px solid var(--border, #e5e7eb)" }}>{t.label}</th>
                  ))}
                </tr>
                <tr style={{ opacity: 0.4 }}>
                  <th></th>
                  {leaveTypes.map((t) => (
                    <>
                      <th key={`${t.code}-e`} style={{ padding: "0.3rem 0.5rem", fontSize: "0.65rem", textTransform: "uppercase", textAlign: "center", borderLeft: "1px solid var(--border, #e5e7eb)" }}>Ent.</th>
                      <th key={`${t.code}-u`} style={{ padding: "0.3rem 0.5rem", fontSize: "0.65rem", textTransform: "uppercase", textAlign: "center" }}>Used</th>
                      <th key={`${t.code}-r`} style={{ padding: "0.3rem 0.5rem", fontSize: "0.65rem", textTransform: "uppercase", textAlign: "center" }}>Left</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balances.map(b => (
                  <tr key={b.employeeId}>
                    <td style={{ padding: "0.875rem 0.875rem" }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{b.employeeName}</div>
                      <div style={{ fontSize: "0.72rem", opacity: 0.5 }}>{b.department}</div>
                    </td>
                    {b.items.map((bal) => (
                      <>
                        <td key={`${b.employeeId}-${bal.typeCode}-e`} style={{ padding: "0.875rem 0.5rem", fontSize: "0.875rem", textAlign: "center", borderLeft: "1px solid var(--border, #f3f4f6)" }}>{bal.entitled}</td>
                        <td key={`${b.employeeId}-${bal.typeCode}-u`} style={{ padding: "0.875rem 0.5rem", fontSize: "0.875rem", textAlign: "center", opacity: 0.6 }}>{bal.used}</td>
                        <td key={`${b.employeeId}-${bal.typeCode}-r`} style={{ padding: "0.875rem 0.5rem", fontSize: "0.875rem", textAlign: "center", fontWeight: 700, color: bal.remaining === 0 ? "#dc2626" : bal.remaining <= 3 ? "#d97706" : "var(--accent)" }}>{bal.remaining}</td>
                      </>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══════════ POLICIES TAB ══════════ */}
        {activeTab === "policies" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>
              <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.15rem" }}>Leave Policies</h2>
                  <p style={{ fontSize: "0.8125rem", opacity: 0.55, margin: 0 }}>Default entitlements and rules per leave category</p>
                </div>
                <button className="btn btn-primary btn-sm" type="button" onClick={openNewTypeModal}>
                  + Add Leave Type
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
                {leaveTypes.map(p => (
                  <div key={p.id} style={{ padding: "1.25rem", borderRadius: "0.5rem", border: `1.5px solid ${p.accentColor}22`, background: p.color }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: p.accentColor, textTransform: "uppercase", letterSpacing: "0.04em" }}>{p.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {p.requiresDoc && (
                          <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "0.15rem 0.45rem", borderRadius: "0.25rem", background: "rgba(0,0,0,0.06)", color: "inherit" }}>Doc required</span>
                        )}
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => openEditTypeModal(p)}>
                          Edit
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1, marginBottom: "0.25rem" }}>{p.defaultDays}</div>
                    <div style={{ fontSize: "0.8125rem", opacity: 0.6 }}>days per year</div>
                    <div style={{ marginTop: "0.875rem", fontSize: "0.75rem", opacity: 0.5 }}>
                      {requests.filter(r => r.typeCode === p.code && r.status === "approved").length} approved request{requests.filter(r => r.typeCode === p.code && r.status === "approved").length !== 1 ? "s" : ""} this year
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* General rules panel */}
            <div className="panel panel-elevated" style={{ padding: "1.75rem 2rem" }}>
              <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>General Rules</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                {[
                  { title: "Notice Period", desc: "Minimum 2 weeks notice required for annual leave. Emergency leave can be applied on the day." },
                  { title: "Carry Over", desc: "Up to 10 unused annual leave days may be carried forward to the next calendar year." },
                  { title: "Pro-rating", desc: "Leave entitlements are pro-rated for employees who joined mid-year based on hire date." },
                  { title: "Public Holidays", desc: "Public holidays are not counted as leave days and are excluded from business day calculations." },
                  { title: "Approval Flow", desc: "All leave requests must be reviewed by HR admin. Sick leave exceeding 3 days requires a medical certificate." },
                  { title: "Unpaid Leave", desc: "Unpaid leave must be pre-approved. Salary deductions are processed in the same payrun month." },
                ].map(rule => (
                  <div key={rule.title} style={{ padding: "1rem 1.125rem", borderRadius: "0.5rem", border: "1px solid var(--border, #e5e7eb)", background: "var(--surface, #f9fafb)" }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.35rem" }}>{rule.title}</div>
                    <div style={{ fontSize: "0.8125rem", opacity: 0.65, lineHeight: 1.5 }}>{rule.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


        {/* ══════ MODAL: New Leave Request ══════ */}
        {showRequestForm && (
          <div className="modal-backdrop" onClick={() => { setShowRequestForm(false); resetRequestForm(); }}>
            <div className="modal-content modal-large" onClick={e => e.stopPropagation()}
              style={{ maxWidth: "600px", width: "100%", borderRadius: "0.75rem", overflow: "hidden" }}>
              <div className="modal-header" style={{ padding: "1.25rem 1.75rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.15rem" }}>
                    {editingRequest ? "Edit Leave Request" : "New Leave Request"}
                  </h3>
                  <p style={{ fontSize: "0.8125rem", opacity: 0.5, margin: 0 }}>
                    {editingRequest ? `Update request ${editingRequest.id}` : "Submit a leave request on behalf of an employee"}
                  </p>
                </div>
                <button className="modal-close" onClick={() => { setShowRequestForm(false); resetRequestForm(); }} type="button">
                  <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <div className="modal-body" style={{ padding: "1.5rem 1.75rem", overflowY: "auto", maxHeight: "72vh" }}>
                <form onSubmit={handleSubmitRequest} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                  {/* Section 1: Who */}
                  <div>
                    <SectionLabel step={1} title="Employee" subtitle="Who is requesting leave?" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div className="form-group" style={{ margin: 0, gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                          Employee <span style={{ color: "var(--error, #ef4444)" }}>*</span>
                        </label>
                        <select value={formEmployee} onChange={e => setFormEmployee(e.target.value)} required
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box", background: "var(--surface, #fff)" }}>
                          <option value="">Select employee…</option>
                          {employees.map(e => (
                            <option key={e.id} value={e.id}>{e.fullName} ? {e.department}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Leave type */}
                  <div>
                    <SectionLabel step={2} title="Leave Type" subtitle="Select the category of leave" />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.625rem" }}>
                      {leaveTypes.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => setFormType(p.code)}
                          style={{
                            padding: "0.625rem 0.5rem", borderRadius: "0.4rem", fontSize: "0.72rem", fontWeight: 600,
                            textAlign: "center", border: `1.5px solid ${formType === p.code ? p.accentColor : "var(--border, #e5e7eb)"}`,
                            background: formType === p.code ? p.color : "transparent",
                            color: formType === p.code ? p.accentColor : "inherit",
                            cursor: "pointer", lineHeight: 1.3,
                          }}>
                          {p.label}
                          <div style={{ fontSize: "0.65rem", opacity: 0.6, marginTop: "0.2rem", fontWeight: 400 }}>{p.defaultDays}d / yr</div>
                        </button>
                      ))}
                    </div>
                    {leaveTypes.length === 0 && (
                      <div className="alert alert-error" style={{ marginTop: "0.75rem", padding: "0.625rem 0.875rem", borderRadius: "0.35rem", fontSize: "0.8125rem" }}>
                        No leave types configured. Add a leave type before submitting requests.
                      </div>
                    )}
                    {getPolicy(formType)?.requiresDoc && (
                      <div style={{ marginTop: "0.75rem", padding: "0.625rem 0.875rem", borderRadius: "0.35rem", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", fontSize: "0.8125rem", color: "#92400e" }}>
                        ⚠ This leave type requires a supporting document (medical certificate or proof).
                      </div>
                    )}
                  </div>

                  {/* Section 3: Dates */}
                  <div>
                    <SectionLabel step={3} title="Dates" subtitle="Select the leave period" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                          Start Date <span style={{ color: "var(--error, #ef4444)" }}>*</span>
                        </label>
                        <input type="date" value={formStart} onChange={e => setFormStart(e.target.value)} required
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                          End Date <span style={{ color: "var(--error, #ef4444)" }}>*</span>
                        </label>
                        <input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} required min={formStart}
                          style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }} />
                      </div>
                    </div>
                    {formStart && formEnd && formDays > 0 && (
                      <div style={{ marginTop: "0.875rem", padding: "0.75rem 1rem", borderRadius: "0.4rem", background: "var(--accent-subtle)", border: "1px solid var(--accent-light)", display: "flex", gap: "2rem" }}>
                        <div>
                          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6 }}>Business Days</div>
                          <div style={{ fontSize: "1rem", fontWeight: 700 }}>{formDays}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6 }}>From</div>
                          <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{fmtDate(formStart)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6 }}>To</div>
                          <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{fmtDate(formEnd)}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 4: Reason */}
                  <div>
                    <SectionLabel step={4} title="Reason" subtitle="Briefly describe the purpose of this leave" />
                    <textarea value={formReason} onChange={e => setFormReason(e.target.value)} required rows={3}
                      placeholder="Provide a brief reason for the leave request…"
                      style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box", resize: "vertical" }} />
                  </div>

                  {formError && <div className="alert alert-error" style={{ padding: "0.75rem 1rem", borderRadius: "0.4rem", fontSize: "0.875rem" }}>{formError}</div>}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <button className="btn btn-secondary" type="button" style={{ padding: "0.625rem 1.25rem", fontSize: "0.875rem" }} onClick={() => { setShowRequestForm(false); resetRequestForm(); }}>Cancel</button>
                    <button className={`btn btn-primary ${formSaving ? "btn-loading" : ""}`} type="submit" disabled={formSaving || leaveTypes.length === 0}
                      style={{ padding: "0.625rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {formSaving && <span className="btn-spinner" />}
                      {formSaving ? "Submitting…" : "Submit Request"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ===== MODAL: Leave Type ===== */}
        {showTypeModal && (
          <div className="modal-backdrop" onClick={() => { setShowTypeModal(false); resetTypeForm(); }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "480px", width: "100%", borderRadius: "0.75rem" }}>
              <div className="modal-header" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.15rem" }}>
                    {editingType ? "Edit Leave Type" : "New Leave Type"}
                  </h3>
                  <p style={{ fontSize: "0.8125rem", opacity: 0.5, margin: 0 }}>
                    {editingType ? `Update ${editingType.label}` : "Define a new leave policy"}
                  </p>
                </div>
                <button className="modal-close" onClick={() => { setShowTypeModal(false); resetTypeForm(); }} type="button">
                  <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <div className="modal-body" style={{ padding: "1.25rem 1.5rem" }}>
                <form onSubmit={handleSaveType} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="form-group">
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                      Leave Type Name <span style={{ color: "var(--error, #ef4444)" }}>*</span>
                    </label>
                    <input
                      value={typeLabel}
                      onChange={(e) => setTypeLabel(e.target.value)}
                      placeholder="e.g. Annual Leave"
                      required
                      style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Type Code</label>
                      <input
                        value={typeCode}
                        onChange={(e) => setTypeCode(e.target.value)}
                        placeholder="annual_leave"
                        disabled={Boolean(editingType)}
                        style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box", opacity: editingType ? 0.6 : 1 }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Default Days</label>
                      <input
                        type="number"
                        min={0}
                        value={typeDays}
                        onChange={(e) => setTypeDays(e.target.value)}
                        style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Accent Color</label>
                      <input
                        value={typeAccent}
                        onChange={(e) => setTypeAccent(e.target.value)}
                        placeholder="#2563eb"
                        style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>Card Color</label>
                      <input
                        value={typeColor}
                        onChange={(e) => setTypeColor(e.target.value)}
                        placeholder="rgba(37,99,235,0.08)"
                        style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
                    <input type="checkbox" checked={typeRequiresDoc} onChange={(e) => setTypeRequiresDoc(e.target.checked)} />
                    Requires supporting document
                  </label>

                  {typeError && <div className="alert alert-error" style={{ padding: "0.75rem 1rem", borderRadius: "0.4rem", fontSize: "0.875rem" }}>{typeError}</div>}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
                    <button className="btn btn-secondary" type="button" onClick={() => { setShowTypeModal(false); resetTypeForm(); }}>Cancel</button>
                    <button className={`btn btn-primary${typeSaving ? " btn-loading" : ""}`} type="submit" disabled={typeSaving}>
                      {typeSaving && <span className="btn-spinner" />}
                      {typeSaving ? "Saving..." : editingType ? "Save Changes" : "Add Type"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {showDetail && (
          <>
            <button className="detail-drawer-backdrop" type="button" onClick={() => setShowDetail(null)} aria-label="Close details" />
            <aside className="detail-drawer" aria-label="Leave request details">
              <div className="detail-drawer-header" style={{ padding: "1.5rem 1.5rem 1rem" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.7rem", fontFamily: "monospace", opacity: 0.45, marginBottom: "0.25rem" }}>{showDetail.id}</div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.15rem" }}>{showDetail.employeeName}</h3>
                  <div style={{ fontSize: "0.8rem", opacity: 0.55 }}>{showDetail.department}</div>
                </div>
                <button className="detail-close" type="button" onClick={() => setShowDetail(null)}>
                  <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>

              <div style={{ padding: "0 1.5rem 0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <StatusBadge status={showDetail.status} />
                {(() => {
                  const badge = getTypeBadge(showDetail.typeCode, showDetail.typeLabel);
                  return <TypeBadge label={badge.label} color={badge.color} accentColor={badge.accentColor} />;
                })()}
                <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "1rem", background: "var(--muted, #f3f4f6)" }}>
                  {showDetail.days} day{showDetail.days !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="detail-drawer-body" style={{ padding: "0 1.5rem", flex: 1, overflowY: "auto" }}>

                <div style={{ marginBottom: "1.25rem" }}>
                  <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.45, margin: "0 0 0.5rem" }}>Leave Period</h4>
                  <div style={{ padding: "0.875rem 1rem", borderRadius: "0.4rem", background: "var(--accent-subtle)", border: "1px solid var(--accent-light)", display: "flex", gap: "2rem" }}>
                    <div>
                      <div style={{ fontSize: "0.65rem", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.04em" }}>From</div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{fmtDate(showDetail.startDate)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.65rem", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.04em" }}>To</div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{fmtDate(showDetail.endDate)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.65rem", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Days</div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{showDetail.days}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: "1.25rem" }}>
                  <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.45, margin: "0 0 0.5rem" }}>Details</h4>
                  <DetailRow label="Applied On" value={fmtDate(showDetail.appliedOn)} />
                  <DetailRow label="Leave Type" value={getPolicy(showDetail.typeCode)?.label ?? showDetail.typeLabel ?? showDetail.typeCode} />
                </div>

                <div style={{ marginBottom: "1.25rem" }}>
                  <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.45, margin: "0 0 0.5rem" }}>Reason</h4>
                  <p style={{ fontSize: "0.875rem", lineHeight: 1.6, opacity: 0.75, margin: 0 }}>{showDetail.reason}</p>
                </div>

                {(showDetail.reviewedBy || showDetail.reviewNote) && (
                  <div style={{ marginBottom: "1.25rem" }}>
                    <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.45, margin: "0 0 0.5rem" }}>Review</h4>
                    <DetailRow label="Reviewed By" value={showDetail.reviewedBy} />
                    <DetailRow label="Reviewed On" value={fmtDate(showDetail.reviewedOn || "")} />
                    {showDetail.reviewNote && (
                      <div style={{ marginTop: "0.5rem", padding: "0.625rem 0.875rem", borderRadius: "0.35rem", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", fontSize: "0.8125rem", opacity: 0.8 }}>
                        {showDetail.reviewNote}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="detail-drawer-actions" style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border, #e5e7eb)", display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
                {showDetail.status === "pending" && (
                  <>
                    <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.875rem" }} type="button"
                      onClick={() => { setShowReviewModal(showDetail); setReviewDecision("approved"); setReviewNote(""); setShowDetail(null); }}>
                      Approve
                    </button>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: "0.875rem" }} type="button"
                      onClick={() => { setShowReviewModal(showDetail); setReviewDecision("rejected"); setReviewNote(""); setShowDetail(null); }}>
                      Reject
                    </button>
                  </>
                )}
                {(showDetail.status === "pending" || showDetail.status === "approved") && (
                  <button className="danger btn" style={{ fontSize: "0.875rem" }} type="button"
                    onClick={() => { setShowCancelConfirm(showDetail); setShowDetail(null); }}>
                    Cancel
                  </button>
                )}
              </div>
            </aside>
          </>
        )}

        {/* ══════ MODAL: Review ══════ */}
        {showReviewModal && (
          <div className="modal-backdrop" onClick={() => setShowReviewModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}
              style={{ maxWidth: "440px", width: "100%", borderRadius: "0.75rem" }}>
              <div className="modal-header" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.15rem" }}>Review Request</h3>
                  <p style={{ fontSize: "0.8125rem", opacity: 0.5, margin: 0 }}>{showReviewModal.id} · {showReviewModal.employeeName}</p>
                </div>
                <button className="modal-close" onClick={() => setShowReviewModal(null)} type="button">
                  <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <div className="modal-body" style={{ padding: "1.25rem 1.5rem" }}>

                {/* Decision toggle */}
                <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1.25rem" }}>
                  {(["approved", "rejected"] as const).map(d => (
                    <button key={d} type="button"
                      onClick={() => setReviewDecision(d)}
                      style={{
                        flex: 1, padding: "0.625rem", borderRadius: "0.4rem", fontSize: "0.875rem", fontWeight: 600,
                        border: `1.5px solid ${reviewDecision === d ? (d === "approved" ? "var(--accent)" : "#dc2626") : "var(--border, #e5e7eb)"}`,
                        background: reviewDecision === d ? (d === "approved" ? "var(--accent-subtle)" : "rgba(239,68,68,0.08)") : "transparent",
                        color: reviewDecision === d ? (d === "approved" ? "var(--accent)" : "#dc2626") : "inherit",
                        cursor: "pointer",
                      }}>
                      {d === "approved" ? "✓ Approve" : "✗ Reject"}
                    </button>
                  ))}
                </div>

                <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                    Note {reviewDecision === "rejected" && <span style={{ color: "var(--error, #ef4444)" }}>*</span>}
                  </label>
                  <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={3}
                    placeholder={reviewDecision === "approved" ? "Optional note to employee…" : "Please provide a reason for rejection…"}
                    style={{ width: "100%", padding: "0.6rem 0.875rem", fontSize: "0.875rem", borderRadius: "0.4rem", border: "1px solid var(--border, #d1d5db)", boxSizing: "border-box", resize: "vertical" }} />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
                  <button className="btn btn-secondary" type="button" style={{ fontSize: "0.875rem" }} onClick={() => setShowReviewModal(null)}>Cancel</button>
                  <button
                    type="button"
                    disabled={reviewSaving || (reviewDecision === "rejected" && !reviewNote.trim())}
                    onClick={handleReview}
                    style={{
                      padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, borderRadius: "0.4rem",
                      border: "none", cursor: "pointer",
                      background: reviewDecision === "approved" ? "var(--accent)" : "#dc2626",
                      color: "#fff", opacity: reviewSaving ? 0.6 : 1,
                    }}>
                    {reviewSaving ? "Saving…" : reviewDecision === "approved" ? "Confirm Approval" : "Confirm Rejection"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ MODAL: Cancel Confirm ══════ */}
        {showCancelConfirm && (
          <div className="modal-backdrop" onClick={() => setShowCancelConfirm(null)}>
            <div className="modal-content modal-mini" onClick={e => e.stopPropagation()}
              style={{ maxWidth: "400px", borderRadius: "0.75rem" }}>
              <div className="modal-header" style={{ padding: "1.25rem 1.5rem" }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0 }}>Cancel Leave Request</h3>
                <button className="modal-close" onClick={() => setShowCancelConfirm(null)} type="button">
                  <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <div className="modal-body" style={{ padding: "0.5rem 1.5rem 1.25rem" }}>
                <p style={{ fontSize: "0.875rem", opacity: 0.7, margin: "0 0 1.25rem" }}>
                  Cancel leave request <strong>{showCancelConfirm.id}</strong> for <strong>{showCancelConfirm.employeeName}</strong>? This cannot be undone.
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
                  <button className="btn btn-secondary" type="button" style={{ fontSize: "0.875rem" }} onClick={() => setShowCancelConfirm(null)}>Keep it</button>
                  <button className="danger btn" type="button" style={{ fontSize: "0.875rem" }} onClick={() => handleCancel(showCancelConfirm)}>Yes, cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}
 
 
 
 
