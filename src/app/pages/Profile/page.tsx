"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import ModuleActions from "@/app/components/ModuleActions";
import { readSession, type UserSession } from "@/app/lib/session";
import { clearOrgLogo, getOrgLogo, setOrgLogo } from "@/app/lib/orgAssets";

export default function ProfilePage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("Africa/Nairobi");
  const [signature, setSignature] = useState("");
  const [status, setStatus] = useState("");
  const [orgLogo, setOrgLogoState] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoStatus, setLogoStatus] = useState("");

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    setSession(current);
    setDisplayName(current.name || "");
    setSignature(`Best regards,\n${current.name || "Payroll Admin"}`);
    if (current.orgId) {
      const storedLogo = getOrgLogo(current.orgId);
      if (storedLogo) {
        setOrgLogoState(storedLogo);
        setLogoUrl(storedLogo.startsWith("data:") ? "" : storedLogo);
      }
    }
  }, [router]);

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    setStatus("Profile updates saved locally.");
    setTimeout(() => setStatus(""), 2500);
  };

  if (!session) {
    return <main className="centered">Loading…</main>;
  }

  const initials = session.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const roleLabel = session.role === "system_admin" ? "System Owner" : "Organization Admin";
  const orgInitials = (session.orgName || session.name)
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const onLogoFile = (file: File | null) => {
    if (!file || !session.orgId) return;
    if (!file.type.startsWith("image/")) {
      setLogoStatus("Please select an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      setOrgLogo(session.orgId!, result);
      setOrgLogoState(result);
      setLogoUrl("");
      setLogoStatus("Organization logo updated.");
      setTimeout(() => setLogoStatus(""), 2000);
    };
    reader.readAsDataURL(file);
  };

  const onLogoUrlSave = () => {
    if (!session.orgId || !logoUrl.trim()) return;
    setOrgLogo(session.orgId, logoUrl.trim());
    setOrgLogoState(logoUrl.trim());
    setLogoStatus("Organization logo updated.");
    setTimeout(() => setLogoStatus(""), 2000);
  };

  const onLogoClear = () => {
    if (!session.orgId) return;
    clearOrgLogo(session.orgId);
    setOrgLogoState(null);
    setLogoUrl("");
    setLogoStatus("Logo removed.");
    setTimeout(() => setLogoStatus(""), 2000);
  };

  return (
    <main className="page-shell">
      <Navbar session={session} />

      <section className="content content-wide">
        {/* Page header */}
        <div className="page-header">
          <div className="page-header-content">
            <h1>Profile</h1>
            <p>Review your admin identity and contact details.</p>
          </div>
          <ModuleActions />
        </div>

        <div className="profile-grid">

          {/* Identity card */}
          <article className="panel panel-elevated profile-card">
            <div className={`profile-avatar ${orgLogo ? "profile-avatar-image" : ""}`}>
              {orgLogo ? (
                <img src={orgLogo} alt={`${session.orgName ?? "Organization"} logo`} />
              ) : (
                <span>{orgInitials}</span>
              )}
            </div>
            <div className="profile-meta">
              <h2>{session.name}</h2>
              <p>{roleLabel}</p>
              <span className="status-badge status-approved">Active</span>
            </div>
          </article>

          {/* Account details */}
          <article className="panel panel-elevated">
            <div className="panel-header">
              <h2>Account Details</h2>
              <p>Keep your account information up to date.</p>
            </div>

            <div className="detail-list">
              <div className="detail-row">
                <span className="detail-label">Email</span>
                <span className="detail-value">{session.email}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Role</span>
                <span className="detail-value">{session.role}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Organization</span>
                <span className="detail-value">{session.orgName ?? "Platform Owner"}</span>
              </div>
            </div>

            <div className="panel-footer">
              <button className="btn btn-secondary" type="button">
                Reset Password
              </button>
              <button className="btn btn-primary" type="button">
                Update Profile
              </button>
            </div>
          </article>

          {/* Edit form */}
          <article className="panel panel-elevated profile-form-panel">
            <div className="panel-header">
              <h2>Edit Profile</h2>
              <p>Manage your contact details and preferences.</p>
            </div>

            <form className="profile-form" onSubmit={onSave}>
              <div className="panel-note profile-logo-panel">
                <div>
                  <div className="profile-logo-title">Organization Logo</div>
                  <p className="muted-text">Used on payslips and PDF exports.</p>
                </div>
                <div className="profile-logo-actions">
                  <input
                    id="profileLogo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="profile-logo-url">
                    <input
                      type="url"
                      placeholder="Paste logo URL"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                    />
                    <button type="button" className="btn btn-secondary" onClick={onLogoUrlSave}>
                      Use URL
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={onLogoClear}>
                      Remove
                    </button>
                  </div>
                  {logoStatus && <span className="profile-logo-status">{logoStatus}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="profileName">Display Name</label>
                <input
                  id="profileName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profileTitle">Job Title</label>
                  <input
                    id="profileTitle"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Payroll Manager"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="profilePhone">Phone</label>
                  <input
                    id="profilePhone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 7xx xxx xxx"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="profileTimezone">Timezone</label>
                <select
                  id="profileTimezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  <option value="Africa/Nairobi">Africa/Nairobi</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New York</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="profileSignature">Email Signature</label>
                <textarea
                  id="profileSignature"
                  rows={3}
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                />
              </div>

              {status && <p className="alert alert-success">{status}</p>}

              <div className="form-actions">
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setSignature("")}
                >
                  Clear Signature
                </button>
                <button className="btn btn-primary" type="submit">
                  Save Changes
                </button>
              </div>
            </form>
          </article>

        </div>
      </section>
    </main>
  );
}
