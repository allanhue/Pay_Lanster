"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import ModuleActions from "@/app/components/ModuleActions";
import { api } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

export default function SupportPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    setSession(current);
    setName(current.name || "");
    setEmail(current.email || "");
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await api.sendSupport({ name, email, subject, message });
      setSuccess(result?.message || "Your message has been sent! We'll get back to you within 24-48 hours.");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide">
        <div className="page-header">
          <div className="page-header-content">
            <h1>Support Center</h1>
            <p>Need help with payroll? Contact our team and we'll get back to you within 2-24 hours.</p>
          </div>
          <ModuleActions />
        </div>

        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="support-grid">
          <div className="panel panel-elevated support-form-panel">
            <div className="panel-header">
              <h2>Contact Support</h2>
              <p>Send us a message and we'll respond via email</p>
            </div>
            <form onSubmit={onSubmit} className="form-grid">
              <div className="form-grid form-two-col">
                <div className="form-group">
                  <label htmlFor="name">Your Name *</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="subject">Subject *</label>
                <select
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  disabled={loading}
                  className={subject ? "" : "placeholder-select"}
                >
                  <option value="" disabled>Select a topic</option>
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Payroll Issue">Payroll Issue</option>
                  <option value="Account Problem">Account Problem</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Billing Question">Billing Question</option>
                  <option value="Bug Report">Bug Report</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  disabled={loading}
                  className="message-textarea"
                />
                <div className="form-hint">
                  {message.length}/500 characters minimum
                </div>
              </div>
              
              <div className="form-actions">
                <button
                  type="button"
                  className={`btn btn-secondary ${loading ? "btn-loading" : ""}`}
                  onClick={() => {
                    setSubject("");
                    setMessage("");
                  }}
                  disabled={loading}
                >
                  Clear Form
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${loading ? "btn-loading" : ""}`}
                  disabled={loading || !name || !email || !subject || message.length < 50}
                >
                  {loading && <span className="btn-spinner" />}
                  {loading ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          </div>

        </div>
      </section>
    </main>
  );
}
