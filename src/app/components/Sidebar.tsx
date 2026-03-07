"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
};

export default function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();

  const orgLinks = [
    { href: "/pages/Dashboard", label: "Dashboard", icon: moduleIcons.dashboard },
    { href: "/pages/Payrun", label: "Payrun", icon: moduleIcons.payrun },
    { href: "/pages/Employee", label: "Employees", icon: moduleIcons.employees },
    { href: "/pages/Loans", label: "Loans", icon: moduleIcons.loans },
    { href: "/pages/Benefits and Allowances", label: "Benefits & Allowances", icon: moduleIcons.benefits },
    { href: "/pages/Approvals", label: "Approvals", icon: moduleIcons.approvals },
    { href: "/pages/Payslips", label: "Payslips", icon: moduleIcons.payslips },
    { href: "/pages/Reports", label: "Reports", icon: moduleIcons.reports },
    { href: "/pages/Intergrations", label: "Integrations", icon: moduleIcons.support },
    { href: "/pages/Settings", label: "Payroll Setup", icon: moduleIcons.settings },
  ];

  const systemLinks = [
    { href: "/system_admin/Dasboard", label: "Overview", icon: moduleIcons.dashboard },
    { href: "/system_admin/Analytics", label: "Analytics", icon: moduleIcons.reports },
    { href: "/system_admin/Configuration", label: "Configuration", icon: moduleIcons.settings },
  ];

  const links = session.role === "system_admin" ? systemLinks : orgLinks;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <span className="dot" />
          <span className="brand-chip" />
        </div>
        <div className="brand-text">
          <span className="brand-name">Payroll Lanster</span>
        </div>
      </div>
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
        <Link className="sidebar-footer-link" href="/pages/Support">
          <span className="sidebar-footer-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M11 16h2M10 9a2 2 0 114 0c0 2-2 2.2-2 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <span>Help</span>
        </Link>
        <Link className="sidebar-footer-link" href={session.role === "system_admin" ? "/system_admin/Configuration" : "/pages/Profile"}>
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
