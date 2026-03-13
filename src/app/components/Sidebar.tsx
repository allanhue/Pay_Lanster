"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { type UserSession } from "@/app/lib/session";

type SidebarProps = {
  session: UserSession;
};

const moduleIcons = {
  dashboard: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 14h4V6H4zm6 8h4v-8h-4zm6-4h4v-4h-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  payrun: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l-2 4h4zM5 8h14v9.5a2.5 2.5 0 01-2.5 2.5H7.5A2.5 2.5 0 015 17.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  employees: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 10a3 3 0 116 0 3 3 0 01-6 0zM4 20c0-3 3-5 7-5s7 2 7 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 8h2a2 2 0 012 2v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  loans: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 5H7a2 2 0 00-2 2v10h14V7a2 2 0 00-2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 12h10M7 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  benefits: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22l-2-2a12 12 0 01-6-10V6a6 6 0 016-6 6 6 0 016 6v4a12 12 0 01-6 10z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h12v16H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 8h4M10 12h4M10 16h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  approvals: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h12v16H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  ),
  payslips: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h10l2 2v16H5V5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 10h6M9 14h6M9 18h4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 7.5a4.5 4.5 0 104.5 4.5 4.5 4.5 0 00-4.5-4.5z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 12l2-2 1.6 1.6M20 12l-2 2-1.6-1.6M12 4l2 2-1.6 1.6M12 20l-2-2 1.6-1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8c0-2.2 2.3-4 4-4h8c1.7 0 4 1.7 4 4v6a2 2 0 01-2 2h-1a3 3 0 01-6 0H6a2 2 0 01-2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 16h5M11 18v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 8h10M7 12h10M7 16h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17" cy="16" r="1" fill="currentColor" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.8" />
      <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.8" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.8" />
      <rect x="6" y="14" width="2" height="2" fill="currentColor" />
      <rect x="11" y="14" width="2" height="2" fill="currentColor" />
      <rect x="16" y="14" width="2" height="2" fill="currentColor" />
    </svg>
  ),
  advanced: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3L4.3 7.6l5.3-.8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
};

export default function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const profileHref = session.role === "system_admin" ? "/system_admin/Configuration" : "/pages/Profile";
  const orgLabel = session.role === "system_admin" ? "Payroll Lanster" : session.orgName;
  const orgMeta = session.role === "system_admin" ? "System Admin" : session.name;

  const orgLinks = [
    { href: "/pages/Dashboard", label: "Dashboard", icon: moduleIcons.dashboard },
    { href: "/pages/Payrun", label: "Payrun", icon: moduleIcons.payrun },
    { href: "/pages/Employee", label: "Employees", icon: moduleIcons.employees },
    { href: "/pages/Loans", label: "Loans", icon: moduleIcons.loans },
    { href: "/pages/Benefits_and_Allowances", label: "Benefits & Allowances", icon: moduleIcons.benefits },
    { href: "/pages/Approvals", label: "Approvals", icon: moduleIcons.approvals },
    { href: "/pages/Payslips", label: "Payslips", icon: moduleIcons.payslips },
    { href: "/pages/Reports", label: "Reports", icon: moduleIcons.reports },
    { href: "/pages/Integrations", label: "Integrations", icon: moduleIcons.support },
    { href: "/pages/Support", label: "Support", icon: moduleIcons.support },
    { href: "/pages/Calendar", label: "Calendar", icon: moduleIcons.calendar },
    { href: "/pages/Settings", label: "Payroll Setup", icon: moduleIcons.settings },
    { href: "/pages/Advanced_Settings", label: "Advanced Settings", icon: moduleIcons.advanced },
  ];

  const systemLinks = [
    { href: "/system_admin/Dasboard", label: "Overview", icon: moduleIcons.dashboard },
    { href: "/system_admin/Analytics", label: "Analytics", icon: moduleIcons.reports },
    { href: "/system_admin/Payments", label: "Payments", icon: moduleIcons.payments },
    { href: "/system_admin/Calendar", label: "Calendar", icon: moduleIcons.calendar },
    { href: "/system_admin/Configuration", label: "Configuration", icon: moduleIcons.settings },
  ];

  const links = session.role === "system_admin" ? systemLinks : orgLinks;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("sidebar_collapsed");
    setCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("sidebar_collapsed", String(collapsed));
    const root = document.documentElement;
    if (collapsed) {
      root.classList.add("sidebar-collapsed");
    } else {
      root.classList.remove("sidebar-collapsed");
    }
  }, [collapsed]);

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="brand">
        <Link className="brand-logo" href={session.role === "system_admin" ? "/system_admin/Dasboard" : "/pages/Dashboard"}>
          <span className="dot" />
          <span className="brand-chip" />
        </Link>
        <div className="brand-text">
          <span className="brand-name">{orgLabel}</span>
          <small>{orgMeta}</small>
        </div>
      </div>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand" : "Collapse"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 7l-5 5 5 5M3 12h18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="sidebar-scroll">
        <nav className="nav-links">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link key={link.href} className={`sidebar-link ${active ? "active" : ""}`} href={link.href}>
                <span className="sidebar-icon">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="sidebar-footer">
        <Link className="sidebar-footer-link" href={profileHref}>
          <span className="sidebar-footer-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5 19c2-4 5-5 7-5s5 1 7 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <span>Profile</span>
        </Link>
      </div>
    </aside>
  );
}
