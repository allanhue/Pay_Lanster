"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/app/lib/api";
import { writeSession } from "@/app/lib/session";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await api.login({ email, password });
      writeSession(user);

      if (user.role === "system_admin") {
        router.push("/system_admin/Dasboard");
      } else {
        router.push("/pages/Dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Sign In</h1>

        <label htmlFor="email">Email</label>
        <input id="email" onChange={(e) => setEmail(e.target.value)} required type="email" value={email} />

        <label htmlFor="password">Password</label>
        <div className="password-field">
          <input
            id="password"
            onChange={(e) => setPassword(e.target.value)}
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="icon-button"
            onClick={() => setShowPassword((prev) => !prev)}
            type="button"
          >
            {showPassword ? (
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path
                  d="M2 3l19 19M10.6 10.7a2 2 0 102.8 2.8M9.9 5.2A10.7 10.7 0 0112 5c6 0 9.8 7 9.8 7a19 19 0 01-4.2 4.9M6.2 7.6A19.4 19.4 0 002.2 12S6 19 12 19a9.7 9.7 0 004-.8"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path
                  d="M2.2 12S6 5 12 5s9.8 7 9.8 7-3.8 7-9.8 7S2.2 12 2.2 12z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle cx="12" cy="12" fill="none" r="3" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            )}
          </button>
        </div>

        {error && <div className="error-text">{error}</div>}

        <button className={loading ? "btn-loading" : ""} disabled={loading} type="submit">
          {loading && <span className="btn-spinner" />}
          {loading ? "Signing in..." : "Login"}
        </button>

        <p>
          New tenant admin? <Link href="/auth/Signup">Create account</Link>
        </p>
      </form>
    </main>
  );
}
