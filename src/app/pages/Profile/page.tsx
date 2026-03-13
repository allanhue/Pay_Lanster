"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

export default function ProfilePage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("Africa/Nairobi");
  const [signature, setSignature] = useState("");
  const [status, setStatus] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    setSession(current);
    setDisplayName(current.name || "");
    setSignature(`Best regards,\n${current.name || "Payroll Admin"}`);
  }, [router]);

  const onSave = (event: FormEvent) => {
    event.preventDefault();
    setStatus("Profile updates saved locally.");
    setTimeout(() => setStatus(""), 2500);
  };

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide">
        <div className="page-header">
          <h1>Profile</h1>
          <p>Review your admin identity and contact details.</p>
        </div>

        <div className="profile-grid">
          <article className="panel panel-elevated profile-card">
            <div className="profile-avatar">
              {session.name.split(" ").map((part) => part[0]).join("").toUpperCase()}
            </div>
            <div className="profile-meta">
              <h2>{session.name}</h2>
              <p>{session.role === "system_admin" ? "System Owner" : "Organization Admin"}</p>
              <span className="status-badge status-approved">Active</span>
            </div>
          </article>

          <article className="panel panel-elevated">
            <div className="panel-header">
              <h2>Account Details</h2>
              <p>Keep your account information up to date.</p>
            </div>
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
            <div className="modal-actions">
              <button className="btn btn-secondary" type="button">
                Reset Password
              </button>
              <button className="btn btn-primary" type="button">
                Update Profile
              </button>
            </div>
          </article>

          <article className="panel panel-elevated">
            <div className="panel-header">
              <h2>Edit Profile</h2>
              <p>Manage your contact details and notifications.</p>
            </div>
            <form className="form-grid" onSubmit={onSave}>
              <div className="form-group">
                <label htmlFor="profileName">Display Name</label>
                <input
                  id="profileName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="form-group form-two-col">
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
                <select id="profileTimezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="Africa/Nairobi">Africa/Nairobi</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="profileSignature">Email Signature</label>
                <textarea
                  id="profileSignature"
                  rows={4}
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                />
              </div>
              {status && <div className="alert alert-success">{status}</div>}
              <div className="form-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setSignature("")}>
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
