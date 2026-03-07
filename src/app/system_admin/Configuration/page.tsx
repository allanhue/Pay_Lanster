"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

export default function ConfigurationPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [maintenanceWindow, setMaintenanceWindow] = useState("Sunday 02:00 UTC");
  const [defaultTrialDays, setDefaultTrialDays] = useState(14);
  const [allowTenantSignup, setAllowTenantSignup] = useState(true);
  const [message, setMessage] = useState("");
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
  }, [router]);

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <h1>Platform Configuration</h1>
        <p>System admin controls tenant onboarding and platform defaults.</p>

        {message && <div className="success-text">{message}</div>}

        <article className="panel form-grid">
          <label htmlFor="window">Maintenance Window</label>
          <input
            id="window"
            onChange={(e) => setMaintenanceWindow(e.target.value)}
            value={maintenanceWindow}
          />

          <label htmlFor="trial">Default Trial Days</label>
          <input
            id="trial"
            min={1}
            onChange={(e) => setDefaultTrialDays(Number(e.target.value))}
            type="number"
            value={defaultTrialDays}
          />

          <label htmlFor="signup">Allow New Tenant Signup</label>
          <select
            id="signup"
            onChange={(e) => setAllowTenantSignup(e.target.value === "yes")}
            value={allowTenantSignup ? "yes" : "no"}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>

          <button
            onClick={() => setMessage("Platform configuration saved (local demo state).")}
            type="button"
          >
            Save Configuration
          </button>
        </article>
      </section>
    </main>
  );
}
