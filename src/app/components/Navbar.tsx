"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, type UserSession } from "@/app/lib/session";
import {
  clearNotifications,
  getNotifications,
  removeNotification,
  subscribeNotifications,
  type AppNotification,
  type NotificationTag,
} from "@/app/lib/notifications";
import Sidebar from "@/app/components/Sidebar";

type NavbarProps = {
  session: UserSession;
};

const NOTIF_TAGS = ["all", "payrun", "payslip", "approval"] as const;

export default function Navbar({ session }: NavbarProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);

  const [openDrawer, setOpenDrawer] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifFilter, setNotifFilter] = useState<"all" | NotificationTag>("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{ type: string; name: string; id: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchHref = session.role === "system_admin" ? "/system_admin/Analytics" : "/pages/Reports";
  const settingsHref = session.role === "system_admin" ? "/system_admin/Configuration" : "/pages/Settings";
  const isOwner = session.role === "system_admin";

  // Notifications subscription
  useEffect(() => {
    setNotifications(getNotifications());
    return subscribeNotifications(() => setNotifications(getNotifications()));
  }, []);

  // Close search on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      setIsSearchOpen(true);
    } else {
      setSearchResults([]);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 300));
      setSearchResults([
        { type: "employee", name: "John Doe", id: "1" },
        { type: "payrun", name: "April 2026 Payroll", id: "PR-0426" },
      ]);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const navigateFromSearch = (params: Record<string, string>) => {
    const query = new URLSearchParams({ q: searchQuery, ...params }).toString();
    router.push(`${searchHref}?${query}`);
    closeSearch();
  };

  const openNotification = (item: AppNotification) => {
    const fallbackMap: Record<string, string> = {
      payrun: "/pages/Payrun",
      payslip: "/pages/Payslips",
      approval: "/pages/Approvals",
    };
    router.push(item.link || fallbackMap[item.tag] || "/pages/Dashboard");
    removeNotification(item.id);
  };

  const filteredNotifications =
    notifFilter === "all"
      ? notifications
      : notifications.filter((n) => n.tag === notifFilter);

  return (
    <>
      <Sidebar session={session} />

      <header className="navbar">
        <div className="top-right">

          {/* Search */}
          <div ref={searchRef} className={`search-container ${isSearchOpen ? "open" : ""}`}>
            {isSearchOpen ? (
              <>
                <form onSubmit={handleSearch} className="search-form">
                  <input
                    autoComplete="off"
                    autoFocus
                    className="search-input"
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search employees, payruns, reports…"
                    type="text"
                    value={searchQuery}
                  />
                  <button
                    aria-label="Search"
                    className="search-submit"
                    disabled={isSearching}
                    type="submit"
                  >
                    {isSearching ? <SpinnerIcon /> : <SearchIcon />}
                  </button>
                </form>

                <button
                  aria-label="Close search"
                  className="top-icon-link search-close"
                  onClick={closeSearch}
                  type="button"
                >
                  <CloseIcon />
                </button>

                {searchResults.length > 0 && (
                  <div className="search-results">
                    <p className="search-results-header">Search Results</p>
                    <ul className="search-results-list">
                      {searchResults.map((result) => (
                        <li key={result.id} className="search-result-item">
                          <button
                            className="search-result-link"
                            onClick={() => navigateFromSearch({ type: result.type, id: result.id })}
                            type="button"
                          >
                            <span className="search-result-icon">
                              {result.type === "employee" ? <PersonIcon /> : <CalendarIcon />}
                            </span>
                            <span className="search-result-content">
                              <span className="search-result-title">{result.name}</span>
                              <span className="search-result-type">{result.type}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="search-results-footer">
                      <button
                        className="view-all-results"
                        onClick={() => navigateFromSearch({})}
                        type="button"
                      >
                        View all results
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <button
                aria-label="Open search"
                className="top-icon-link search-toggle"
                onClick={() => setIsSearchOpen(true)}
                type="button"
              >
                <SearchIcon />
              </button>
            )}
          </div>

          {/* Help */}
          <Link aria-label="Help & Support" className="top-icon-link" href="/pages/Support">
            <HelpIcon />
          </Link>

          {/* Settings */}
          <Link aria-label="Settings" className="top-icon-link" href={settingsHref}>
            <SettingsIcon />
          </Link>

          {/* Notifications */}
          <button
            aria-label="Notifications"
            className="top-icon-link notif-button"
            onClick={() => setOpenDrawer(true)}
            type="button"
          >
            <BellIcon />
            {notifications.length > 0 && <span className="notif-dot" />}
          </button>

          {/* User */}
          <div className="nav-user">
            <div className="nav-user-info">
              <p>{session.name}</p>
              <small>{isOwner ? "Owner" : "Org Admin"}</small>
            </div>
            <button
              className="nav-logout-btn"
              onClick={() => {
                clearSession();
                router.push("/auth/login");
              }}
              title="Logout"
              type="button"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </header>

      {/* Notification Drawer */}
      <aside className={`notif-drawer ${openDrawer ? "open" : ""}`}>
        <div className="notif-header">
          <div className="notif-header-content">
            <h3>Notifications</h3>
            <span className="notif-count">{notifications.length}</span>
          </div>
          <div className="notif-header-actions">
            <button
              className="clear-all-btn"
              onClick={clearNotifications}
              title="Clear all notifications"
              type="button"
            >
              Clear All
            </button>
            <button
              className="drawer-close"
              onClick={() => setOpenDrawer(false)}
              title="Close"
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="notif-filters">
          {NOTIF_TAGS.map((tag) => (
            <button
              key={tag}
              className={`notif-filter ${notifFilter === tag ? "active" : ""}`}
              onClick={() => setNotifFilter(tag)}
              type="button"
            >
              {tag === "all" ? "All" : tag}
            </button>
          ))}
        </div>

        {notifications.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-icon">
              <BellIcon />
            </div>
            <p className="notif-empty-title">No notifications</p>
            <p className="notif-empty-desc">You're all caught up! We'll notify you when there are updates.</p>
          </div>
        ) : (
          <ul className="notif-list">
            {filteredNotifications.map((item) => (
              <li key={item.id} className={`notif-item notif-${item.tag}`}>
                <div className="notif-content">
                  <div className="notif-header-item">
                    <div className="notif-icon">
                      {item.tag === "payrun" && <PayrunIcon />}
                      {item.tag === "payslip" && <PayslipIcon />}
                      {item.tag === "approval" && <ApprovalIcon />}
                    </div>
                    <div className="notif-text">
                      <h4>{item.title}</h4>
                      <p>{item.detail}</p>
                    </div>
                  </div>
                  <div className="notif-meta">
                    <span className={`notif-tag tag-${item.tag}`}>{item.tag}</span>
                    <span className="notif-time">{item.time}</span>
                    <button
                      className="notif-open"
                      onClick={() => openNotification(item)}
                      type="button"
                    >
                      View
                    </button>
                    <button
                      className="notif-remove"
                      onClick={() => removeNotification(item.id)}
                      title="Remove notification"
                      type="button"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {openDrawer && (
        <button
          aria-label="Close notifications"
          className="drawer-backdrop"
          onClick={() => setOpenDrawer(false)}
          type="button"
        />
      )}
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" fill="none" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg aria-hidden="true" className="search-spinner" viewBox="0 0 24 24">
      <circle
        cx="12" cy="12" r="10"
        fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeDasharray="31.416" strokeDashoffset="31.416"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <circle cx="12" cy="17" fill="currentColor" r="1" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 8.8A3.2 3.2 0 1112 15.2 3.2 3.2 0 0112 8.8z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19.4 13.1l1.2-1.1-1.2-1.1-.2-1.6-1.5-.5-.9-1.3-1.6.3-1.4-.8-1.4.8-1.6-.3-.9 1.3-1.5.5-.2 1.6L3.4 12l1.2 1.1.2 1.6 1.5.5.9 1.3 1.6-.3 1.4.8 1.4-.8 1.6.3.9-1.3 1.5-.5.2-1.6z"
        fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M18 8A6 6 0 0012 2v0a6 6 0 00-6 6c0 7-3 9-3 9h18s-3-2-3-9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M9.2 20.2a3 3 0 005.6 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <polyline fill="none" points="16,17 21,12 16,7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <line fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="7" fill="none" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect fill="none" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" width="18" x="3" y="4" />
      <line stroke="currentColor" strokeWidth="1.5" x1="16" x2="16" y1="2" y2="6" />
      <line stroke="currentColor" strokeWidth="1.5" x1="8" x2="8" y1="2" y2="6" />
      <line stroke="currentColor" strokeWidth="1.5" x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function PayrunIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function PayslipIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <polyline fill="none" points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ApprovalIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M9 11l3 3L22 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}