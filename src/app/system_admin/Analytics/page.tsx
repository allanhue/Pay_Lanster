"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api, type TenantStats } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

export default function AnalyticsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [tenants, setTenants] = useState<TenantStats[]>([]);
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
      .tenantAnalytics()
      .then(setTenants)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load analytics");
      });
  }, [router]);

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <h1>Tenant Analytics</h1>
        <p>Cross-tenant payroll distribution and employee counts.</p>
        {error && <div className="error-text">{error}</div>}

        <article className="panel">
          {tenants.length === 0 ? (
            <p>No tenants available.</p>
          ) : (
            <ul className="simple-list">
              {tenants.map((tenant) => (
                <li key={tenant.orgId}>
                  <span>{tenant.orgName}</span>
                  <span>{tenant.employees} employees</span>
                  <span>${tenant.monthlyPayroll.toLocaleString()} / month</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}
