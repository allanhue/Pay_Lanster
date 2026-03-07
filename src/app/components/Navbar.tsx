"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSession, type UserSession } from "@/app/lib/session";
import Sidebar from "@/app/components/Sidebar";

type NavbarProps = {
  session: UserSession;
};

export default function Navbar({ session }: NavbarProps) {
  const router = useRouter();
  const searchHref = session.role === "system_admin" ? "/system_admin/Analytics" : "/pages/Reports";
  const settingsHref = session.role === "system_admin" ? "/system_admin/Configuration" : "/pages/Settings";
  const profileHref = session.role === "system_admin" ? "/system_admin/Configuration" : "/pages/Profile";
  const helpHref = "/pages/Support";

  return (
    <>
      <Sidebar session={session} />
      <header className="navbar">
        <div className="top-left">
          <strong>{session.role === "system_admin" ? "System Admin" : session.orgName}</strong>
        </div>

        <div className="top-right">
          <Link aria-label="Search" className="top-icon-link" href={searchHref}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="11" cy="11" fill="none" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16 16l5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
            </svg>
          </Link>

          <Link aria-label="Settings" className="top-icon-link" href={settingsHref}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 8.8A3.2 3.2 0 1112 15.2 3.2 3.2 0 0112 8.8z" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M19.4 13.1l1.2-1.1-1.2-1.1-.2-1.6-1.5-.5-.9-1.3-1.6.3-1.4-.8-1.4.8-1.6-.3-.9 1.3-1.5.5-.2 1.6L3.4 12l1.2 1.1.2 1.6 1.5.5.9 1.3 1.6-.3 1.4.8 1.4-.8 1.6.3.9-1.3 1.5-.5.2-1.6z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2" />
            </svg>
          </Link>

          <Link aria-label="Help" className="top-icon-link" href={helpHref}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="12" cy="12" fill="none" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9.9 9.2a2.5 2.5 0 014.7 1.2c0 1.8-2.2 2.1-2.2 3.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
              <circle cx="12" cy="17.3" r="1" />
            </svg>
          </Link>

          <button aria-label="Notifications" className="top-icon-link" type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 4a5 5 0 00-5 5v2.2l-1.3 2.2A1 1 0 006.6 15h10.8a1 1 0 00.9-1.6L17 11.2V9a5 5 0 00-5-5z" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M10 17a2 2 0 004 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
            </svg>
            <span className="notif-dot" />
          </button>

          <Link aria-label="Profile" className="top-icon-link" href={profileHref}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="12" cy="8" fill="none" r="3.2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5.2 18a6.8 6.8 0 0113.6 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
            </svg>
          </Link>

          <div className="nav-user">
            <p>{session.name}</p>
            <small>{session.role === "system_admin" ? "Owner" : session.orgName}</small>
          </div>

          <button
            onClick={() => {
              clearSession();
              router.push("/auth/login");
            }}
            type="button"
          >
            Logout
          </button>
        </div>
      </header>
    </>
  );
}
