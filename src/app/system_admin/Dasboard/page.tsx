"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

export default function SystemDashboardPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [stats, setStats] = useState({ tenants: 0, employees: 0, payroll: 0 });
  const [error, setError] = useState("");
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
    void api
      .systemDashboard()
      .then(setStats)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load overview");
      });
  }, [router]);

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <h1>System Admin Overview</h1>
        <p>Monitor tenants and overall payroll exposure.</p>
        {error && <div className="error-text">{error}</div>}

        <div className="cards-grid">
          <article className="card">
            <h3>Total Tenants</h3>
            <strong>{stats.tenants}</strong>
          </article>
          <article className="card">
            <h3>Total Employees</h3>
            <strong>{stats.employees}</strong>
          </article>
          <article className="card">
            <h3>Global Payroll</h3>
            <strong>${stats.payroll.toLocaleString()}</strong>
          </article>
        </div>
      </section>
    </main>
  );
}
