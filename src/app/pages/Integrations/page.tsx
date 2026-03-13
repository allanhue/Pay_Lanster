"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api, type ProjectIntegrationStatus } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

type Integration = { name: string; purpose: string; status: "connected" | "not_connected" };

const integrationItems: Integration[] = [
  { name: "Zoho Books", purpose: "Accounting sync", status: "connected" },
  { name: "Zoho People", purpose: "Employee records", status: "connected" },
  { name: "Project Forge", purpose: "Project cost allocation", status: "not_connected" },
];

export default function IntegrationsPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [projectStatus, setProjectStatus] = useState<ProjectIntegrationStatus | null>(null);
  const router = useRouter();

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    setSession(current);
    api.projectIntegrationStatus().then(setProjectStatus).catch(() => setProjectStatus(null));
  }, [router]);

  if (!session) return <main className="centered">Loading...</main>;

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <div className="page-header">
          <h1>Integrations</h1>
          <p>Connect payroll modules with third-party systems.</p>
        </div>

        <div className="panel panel-elevated">
          <div className="panel-header">
            <div>
              <h2>Project Management</h2>
              <p>Sync payroll reports into your project app.</p>
            </div>
            <span className={`status-badge ${projectStatus?.connected ? "status-approved" : "status-pending"}`}>
              {projectStatus?.connected ? "Connected" : "Not connected"}
            </span>
          </div>
          {/* <div className="info-card">
            <p>{projectStatus?.message || "PROJECT_APP is not configured yet."}</p>
            <p className="muted-text">Base URL: {projectStatus?.baseUrl || "—"}</p>
          </div> */}
        </div>
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
