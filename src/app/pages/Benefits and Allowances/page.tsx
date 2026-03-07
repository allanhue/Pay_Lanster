"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { readSession, type UserSession } from "@/app/lib/session";

type Benefit = {
  name: string;
  amount: number;
  frequency: "Monthly" | "One-time" | "Annual";
};

const defaults: Benefit[] = [
  { name: "Transport Allowance", amount: 150, frequency: "Monthly" },
  { name: "Meal Allowance", amount: 90, frequency: "Monthly" },
  { name: "Wellness Support", amount: 280, frequency: "Annual" },
];

export default function BenefitsAndAllowancesPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [benefits, setBenefits] = useState<Benefit[]>(defaults);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Benefit["frequency"]>("Monthly");
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    if (current.role !== "org_admin") {
      router.replace("/system_admin/Dasboard");
      return;
    }
    setSession(current);
  }, [router]);

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!name || !amount) return;
    setAdding(true);

    setBenefits((prev) => [
      ...prev,
      { name, amount: Number(amount), frequency },
    ]);
    setName("");
    setAmount("");
    setTimeout(() => setAdding(false), 250);
  };

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content">
        <h1>Benefits & Allowances</h1>
        <p>Configure recurring perks alongside payroll.</p>

        <article className="panel form-grid">
          <label htmlFor="benefit-name">Benefit name</label>
          <input
            id="benefit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Learning stipend"
          />

          <label htmlFor="benefit-amount">Amount</label>
          <input
            id="benefit-amount"
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
          />

          <label htmlFor="benefit-frequency">Frequency</label>
          <select
            id="benefit-frequency"
            value={frequency}
            onChange={(e) =>
              setFrequency(e.target.value as Benefit["frequency"])
            }
          >
            <option value="Monthly">Monthly</option>
            <option value="One-time">One-time</option>
            <option value="Annual">Annual</option>
          </select>

          <button className={adding ? "btn-loading" : ""} disabled={adding} type="button" onClick={handleAdd}>
            {adding && <span className="btn-spinner" />}
            {adding ? "Adding..." : "Add benefit"}
          </button>
        </article>

        <article className="panel">
          <h2>Configured perks</h2>
          <ul className="simple-list">
            {benefits.map((benefit) => (
              <li key={`${benefit.name}-${benefit.frequency}`}>
                <span>{benefit.name}</span>
                <span>
                  {benefit.amount.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                  })}
                </span>
                <span>{benefit.frequency}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
