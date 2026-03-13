"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

type ApprovalMode = "single" | "multi";

const STORAGE_KEY = "payroll_approvers";

export default function AdvancedSettingsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [mode, setMode] = useState<ApprovalMode>("single");
  const [approvers, setApprovers] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [sending, setSending] = useState(false);
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
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { mode?: ApprovalMode; approvers?: string[] };
        if (parsed?.mode) setMode(parsed.mode);
        if (Array.isArray(parsed?.approvers)) setApprovers(parsed.approvers);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, approvers }));
  }, [mode, approvers]);

  const effectiveApprovers = useMemo(() => {
    if (mode === "single") {
      return session?.email ? [session.email] : [];
    }
    return approvers;
  }, [mode, approvers, session?.email]);

  const addApprover = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || approvers.includes(trimmed)) return;
    setApprovers((prev) => [...prev, trimmed]);
    setEmail("");
  };

  const removeApprover = (address: string) => {
    setApprovers((prev) => prev.filter((item) => item !== address));
  };

  const sendApprovalInvites = async () => {
    if (!effectiveApprovers.length) {
      setStatus({ ok: false, message: "Add at least one approver email." });
      return;
    }
    setStatus(null);
    setSending(true);
    try {
      const orgName = session?.orgName || "Payroll Lanster";
      const html = `
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#13233f;line-height:1.5">
          <h2>Payroll Approval Setup</h2>
          <p>${orgName} has added you as a payroll approver. You will receive payrun approval requests by email.</p>
          <p>If you have any questions, reply to this email or contact your payroll admin.</p>
        </div>
      `;
      await api.sendMail({
        to: effectiveApprovers,
        subject: `${orgName} payroll approver access`,
        html,
      });
      setStatus({ ok: true, message: `Invites sent to ${effectiveApprovers.length} approver(s).` });
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : "Failed to send invites" });
    } finally {
      setSending(false);
    }
  };

  if (!session) return <main className="centered">Loading...</main>;

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide">
        <div className="page-header">
          <h1>Advanced Settings</h1>
          <p>Configure approval workflows, approver emails, and escalation rules.</p>
        </div>

        <div className="split-grid">
          <article className="panel panel-elevated">
            <div className="panel-header">
              <h2>Approval Pipeline</h2>
              <p>Choose single approver or multi-approval pipeline.</p>
            </div>

            <div className="toggle-row">
              <button
                type="button"
                className={`toggle-chip ${mode === "single" ? "active" : ""}`}
                onClick={() => setMode("single")}
              >
                Single Approver
              </button>
              <button
                type="button"
                className={`toggle-chip ${mode === "multi" ? "active" : ""}`}
                onClick={() => setMode("multi")}
              >
                Multi Approver
              </button>
            </div>

            {mode === "single" ? (
              <div className="panel-note">
                <strong>Default approver:</strong> {session.email}
                <p className="muted-text">All payruns route to the org admin email by default.</p>
              </div>
            ) : (
              <form className="form-grid" onSubmit={addApprover}>
                <div className="form-group">
                  <label htmlFor="approverEmail">Approver email</label>
                  <input
                    id="approverEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="approver@company.com"
                  />
                </div>
                <button type="submit" className="btn btn-secondary btn-sm">
                  Add approver
                </button>
              </form>
            )}

            <div className="panel-subsection">
              <h3>Current Approvers</h3>
              <ul className="simple-list simple-list-compact">
                {effectiveApprovers.length === 0 && <li>No approvers added yet.</li>}
                {effectiveApprovers.map((addr) => (
                  <li key={addr}>
                    <span>{addr}</span>
                    {mode === "multi" && (
                      <button className="link danger-link" type="button" onClick={() => removeApprover(addr)}>
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="panel panel-elevated">
            <div className="panel-header">
              <h2>Notify Approvers</h2>
              <p>Send approval invite or pipeline update to your approvers.</p>
            </div>

            {status && (
              <div className={`alert ${status.ok ? "alert-success" : "alert-error"}`}>
                {status.message}
              </div>
            )}

            <div className="info-card">
              <h4>What gets emailed?</h4>
              <p>Approvers will receive payrun approval requests and reminders. This only configures the routing list.</p>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={sendApprovalInvites}
                disabled={sending}
              >
                {sending ? "Sending..." : "Send Approver Email"}
              </button>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
