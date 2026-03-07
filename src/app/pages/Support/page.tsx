"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

export default function SupportPage() {
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

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <h1>Support</h1>
        <p>Need help with payroll setup? Start here.</p>
        <article className="panel">
          <p>Contact admin support, review troubleshooting tips, and track ticket status.</p>
        </article>
      </section>
    </main>
  );
}
