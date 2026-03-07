"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

export default function ProfilePage() {
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
        <h1>Profile</h1>
        <article className="panel">
          <p>
            <strong>Name:</strong> {session.name}
          </p>
          <p>
            <strong>Email:</strong> {session.email}
          </p>
          <p>
            <strong>Role:</strong> {session.role}
          </p>
          <p>
            <strong>Organization:</strong> {session.orgName ?? "Platform Owner"}
          </p>
        </article>
      </section>
    </main>
  );
}
