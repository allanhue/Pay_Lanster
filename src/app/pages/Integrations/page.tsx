"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

type Integration = { name: string; purpose: string; status: "connected" | "not_connected" };

const integrationItems: Integration[] = [
  { name: "Zoho Books", purpose: "Accounting sync", status: "connected" },
  { name: "Zoho People", purpose: "Employee records", status: "connected" },
  { name: "Project Forge", purpose: "Project cost allocation", status: "not_connected" },
];

export default function IntegrationsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const router = useRouter();

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    setSession(current);
  }, [router]);

  if (!session) return <main className="centered">Loading...</main>;

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <h1>Integrations</h1>
        <p>Connect payroll modules with third-party systems.</p>
        <article className="panel">
          <table className="loan-table">
            <thead>
              <tr>
                <th>Integration</th>
                <th>Purpose</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {integrationItems.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.purpose}</td>
                  <td>
                    <span className={`loan-chip loan-${item.status === "connected" ? "approved" : "draft"}`}>
                      {item.status === "connected" ? "connected" : "not connected"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    </main>
  );
}
