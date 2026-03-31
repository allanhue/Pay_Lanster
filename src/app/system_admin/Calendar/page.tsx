"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import ModuleActions from "@/app/components/ModuleActions";
import { readSession, type UserSession } from "@/app/lib/session";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  type: "payroll" | "holiday" | "meeting" | "deadline" | "reminder";
  organizationId?: string;
  organizationName?: string;
  status: "upcoming" | "completed" | "cancelled";
}

const EVENT_TYPES = ["all", "payroll", "holiday", "meeting", "deadline", "reminder"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MOCK_EVENTS: CalendarEvent[] = [
  { id: "evt_001", title: "Monthly Payroll Processing", description: "Process March 2026 payroll for all organizations", date: "2026-03-31", time: "09:00 AM", type: "payroll", organizationId: "org_001", organizationName: "Tech Corp", status: "upcoming" },
  { id: "evt_002", title: "Q1 Tax Filing Deadline", description: "Quarterly tax filing deadline for all organizations", date: "2026-04-15", time: "11:59 PM", type: "deadline", status: "upcoming" },
  { id: "evt_003", title: "System Maintenance", description: "Scheduled system maintenance and updates", date: "2026-03-25", time: "02:00 AM", type: "reminder", status: "upcoming" },
  { id: "evt_004", title: "Good Friday", description: "Public holiday — No payroll processing", date: "2026-04-18", time: "All Day", type: "holiday", status: "upcoming" },
  { id: "evt_005", title: "Biweekly Payroll — Org 2", description: "Biweekly payroll processing for Marketing Agency", date: "2026-03-22", time: "10:00 AM", type: "payroll", organizationId: "org_002", organizationName: "Marketing Agency", status: "completed" },
  { id: "evt_006", title: "Admin Meeting", description: "Monthly system admin review meeting", date: "2026-03-28", time: "03:00 PM", type: "meeting", status: "upcoming" },
];

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export default function CalendarPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    const current = readSession();
    if (!current) { router.replace("/auth/login"); return; }
    if (current.role !== "system_admin") { router.replace("/pages/Dashboard"); return; }
    setSession(current);
    // Replace with actual API call
    setEvents(MOCK_EVENTS);
    setLoading(false);
  }, [router]);

  const filteredEvents = useMemo(() =>
    events.filter((e) => {
      const matchesSearch = !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || e.type === filterType;
      return matchesSearch && matchesType;
    }),
    [events, searchQuery, filterType]
  );

  const upcomingEvents = useMemo(() =>
    filteredEvents
      .filter((e) => e.status === "upcoming")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5),
    [filteredEvents]
  );

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return filteredEvents.filter((e) => e.date === dateStr);
  };

  const todayEvents = useMemo(() => getEventsForDate(new Date()), [filteredEvents]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [currentDate]);

  const navigateMonth = (dir: number) =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1));

  const monthLabel = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (!session) return <main className="centered">Loading…</main>;

  return (
    <main className="page-shell">
      <Navbar session={session} />

      <section className="content content-wide">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-content">
            <h1>Calendar</h1>
            <p>Manage payroll schedules, holidays, and important dates.</p>
          </div>
          <ModuleActions />
        </div>

        {/* Calendar nav bar */}
        <div className="panel panel-elevated calendar-controls-panel">
          <div className="calendar-nav">
            <button className="btn btn-secondary btn-sm" onClick={() => navigateMonth(-1)} type="button">
              <ChevronLeftIcon /> Previous
            </button>
            <h2 className="calendar-month-label">{monthLabel}</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => navigateMonth(1)} type="button">
              Next <ChevronRightIcon />
            </button>
          </div>
          <div className="calendar-nav-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(new Date())} type="button">
              Today
            </button>
          </div>
        </div>

        {/* Main grid: calendar + sidebar */}
        <div className="calendar-layout">

          {/* Month grid */}
          <article className="panel panel-elevated calendar-grid-panel">
            <div className="calendar-weekdays">
              {WEEKDAYS.map((d) => (
                <div key={d} className="calendar-weekday">{d}</div>
              ))}
            </div>
            <div className="calendar-days">
              {calendarDays.map((date, i) => {
                const isToday = date?.toDateString() === new Date().toDateString();
                const isSelected = date?.toDateString() === selectedDate?.toDateString();
                const dayEvents = date ? getEventsForDate(date) : [];
                return (
                  <div
                    key={i}
                    className={`calendar-day ${date ? "has-date" : "empty"} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
                    onClick={() => date && setSelectedDate(date)}
                  >
                    {date && (
                      <>
                        <span className="calendar-date-number">{date.getDate()}</span>
                        <div className="calendar-event-dots">
                          {dayEvents.slice(0, 3).map((event, idx) => (
                            <span key={idx} className={`calendar-event-dot event-${event.type}`} title={event.title} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </article>

          {/* Sidebar */}
          <div className="calendar-sidebar">

            {/* Today */}
            <article className="panel panel-elevated">
              <div className="panel-header">
                <h3>Today's Events</h3>
                <span className="notif-count">{todayEvents.length}</span>
              </div>
              {todayEvents.length === 0 ? (
                <div className="table-empty">
                  <p className="table-empty-desc">No events scheduled for today.</p>
                </div>
              ) : (
                <ul className="event-list">
                  {todayEvents.map((event) => (
                    <EventListItem
                      key={event.id}
                      event={event}
                      onView={() => setSelectedEvent(event)}
                    />
                  ))}
                </ul>
              )}
            </article>

            {/* Upcoming */}
            <article className="panel panel-elevated">
              <div className="panel-header">
                <h3>Upcoming Events</h3>
                <span className="notif-count">{upcomingEvents.length}</span>
              </div>
              {upcomingEvents.length === 0 ? (
                <div className="table-empty">
                  <p className="table-empty-desc">No upcoming events.</p>
                </div>
              ) : (
                <ul className="event-list">
                  {upcomingEvents.map((event) => (
                    <EventListItem
                      key={event.id}
                      event={event}
                      showDate
                      onView={() => setSelectedEvent(event)}
                    />
                  ))}
                </ul>
              )}
            </article>

          </div>
        </div>

        {/* All events table */}
        <article className="panel panel-elevated">
          <div className="panel-header panel-header-row">
            <div>
              <h2>All Events</h2>
              <p>Filter and review every scheduled item.</p>
            </div>
            <div className="filter-row">
              <div className="search-field">
                <SearchIcon />
                <input
                  id="searchEvents"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events…"
                  type="text"
                  value={searchQuery}
                />
              </div>
              <select
                id="filterType"
                onChange={(e) => setFilterType(e.target.value)}
                value={filterType}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "all" ? "All types" : capitalize(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="table-empty"><p className="table-empty-desc">Loading events…</p></div>
          ) : filteredEvents.length === 0 ? (
            <div className="table-empty">
              <CalendarEmptyIcon />
              <p className="table-empty-title">No events found</p>
              <p className="table-empty-desc">Try adjusting your search or filter.</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearchQuery(""); setFilterType("all"); }}
                type="button"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Organization</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <div className="event-cell">
                          <span className={`event-type-icon event-${event.type}`}>
                            <EventIcon type={event.type} />
                          </span>
                          <div>
                            <p className="event-cell-title">{event.title}</p>
                            <p className="event-cell-desc">{event.description}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`event-type-badge event-${event.type}`}>
                          {capitalize(event.type)}
                        </span>
                      </td>
                      <td>{formatDate(event.date)}</td>
                      <td>{event.time}</td>
                      <td>{event.organizationName || "System-wide"}</td>
                      <td>
                        <span className={`status-badge status-${event.status}`}>
                          {capitalize(event.status)}
                        </span>
                      </td>
                      <td className="action-cell">
                        <button
                          aria-label="View event details"
                          className="action-menu-btn"
                          onClick={() => setSelectedEvent(event)}
                          type="button"
                        >
                          <DotsIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {/* Event detail modal */}
        {selectedEvent && (
          <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Event Details</h3>
                <button aria-label="Close modal" className="modal-close" onClick={() => setSelectedEvent(null)} type="button">
                  <CloseIcon />
                </button>
              </div>
              <div className="modal-body">
                <div className="detail-list">
                  <div className="detail-row">
                    <span className="detail-label">Title</span>
                    <span className="detail-value">{selectedEvent.title}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Description</span>
                    <span className="detail-value">{selectedEvent.description}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Type</span>
                    <span className={`event-type-badge event-${selectedEvent.type}`}>
                      {capitalize(selectedEvent.type)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Date</span>
                    <span className="detail-value">{formatDate(selectedEvent.date)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Time</span>
                    <span className="detail-value">{selectedEvent.time}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Organization</span>
                    <span className="detail-value">{selectedEvent.organizationName || "System-wide"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Status</span>
                    <span className={`status-badge status-${selectedEvent.status}`}>
                      {capitalize(selectedEvent.status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventListItem({
  event,
  showDate = false,
  onView,
}: {
  event: CalendarEvent;
  showDate?: boolean;
  onView: () => void;
}) {
  return (
    <li className="event-list-item">
      <span className={`event-list-icon event-${event.type}`}>
        <EventIcon type={event.type} />
      </span>
      <div className="event-list-content">
        <p className="event-list-title">{event.title}</p>
        <div className="event-list-meta">
          {showDate && <span>{formatDate(event.date)}</span>}
          <span>{event.time}</span>
          {event.organizationName && <span>{event.organizationName}</span>}
        </div>
      </div>
      <button aria-label="View event" className="action-menu-btn" onClick={onView} type="button">
        <DotsIcon />
      </button>
    </li>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function EventIcon({ type }: { type: CalendarEvent["type"] }) {
  switch (type) {
    case "payroll":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
        </svg>
      );
    case "holiday":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <polyline fill="none" points="3.27,6.96 12,12.01 20.73,6.96" stroke="currentColor" strokeWidth="1.5" />
          <line stroke="currentColor" strokeWidth="1.5" x1="12" x2="12" y1="22.08" y2="12" />
        </svg>
      );
    case "meeting":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="9" cy="7" fill="none" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "deadline":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="1.5" />
          <polyline fill="none" points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "reminder":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.73 21a2 2 0 01-3.46 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    default:
      return null;
  }
}

function DotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="5" fill="currentColor" r="1.6" />
      <circle cx="12" cy="12" fill="currentColor" r="1.6" />
      <circle cx="12" cy="19" fill="currentColor" r="1.6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" fill="none" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 21l-4.35-4.35" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <polyline fill="none" points="15,18 9,12 15,6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <polyline fill="none" points="9,18 15,12 9,6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function CalendarEmptyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <rect fill="none" height="36" rx="3" stroke="currentColor" strokeWidth="1.5" width="36" x="6" y="8" />
      <line stroke="currentColor" strokeWidth="1.5" x1="16" x2="16" y1="4" y2="12" />
      <line stroke="currentColor" strokeWidth="1.5" x1="32" x2="32" y1="4" y2="12" />
      <line stroke="currentColor" strokeWidth="1.5" x1="6" x2="42" y1="20" y2="20" />
      <path d="M18 30l3 3 6-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}