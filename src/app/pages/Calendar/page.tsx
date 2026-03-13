"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { api } from "@/app/lib/api";
import { readSession, type UserSession } from "@/app/lib/session";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  type: "payroll" | "holiday" | "meeting" | "deadline" | "reminder";
  status: "upcoming" | "completed" | "cancelled";
}

export default function OrgCalendarPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
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
    loadEvents();
  }, [router]);

  const loadEvents = async () => {
    try {
      const data = await api.getDemoData();
      setEvents(Array.isArray(data.calendar) ? (data.calendar as CalendarEvent[]) : []);
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = searchQuery === "" || 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === "all" || event.type === filterType;

    return matchesSearch && matchesType;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case "payroll":
        return (
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case "holiday":
        return (
          <svg viewBox="0 0 24 24">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <polyline points="3.27,6.96 12,12.01 20.73,6.96" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case "meeting":
        return (
          <svg viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 3.13a4 4 0 010 7.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case "deadline":
        return (
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <polyline points="12,6 12,12 16,14" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case "reminder":
        return (
          <svg viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13.73 21a2 2 0 01-3.46 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "payroll": return "event-payroll";
      case "holiday": return "event-holiday";
      case "meeting": return "event-meeting";
      case "deadline": return "event-deadline";
      case "reminder": return "event-reminder";
      default: return "";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "status-completed";
      case "upcoming": return "status-processing";
      case "cancelled": return "status-cancelled";
      default: return "";
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return filteredEvents.filter(event => event.date === dateStr);
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const upcomingEvents = filteredEvents
    .filter(event => event.status === "upcoming")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  const todayEvents = getEventsForDate(new Date());
  const summary = useMemo(
    () => ({
      total: events.length,
      payroll: events.filter((event) => event.type === "payroll").length,
      deadlines: events.filter((event) => event.type === "deadline").length,
    }),
    [events]
  );

  if (!session) {
    return <main className="centered">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <Navbar session={session} />
      <section className="content content-wide">
        <div className="page-header">
          <h1>Calendar</h1>
          <p>Manage your organization's payroll schedule, holidays, and important dates</p>
        </div>

        <div className="cards-grid three-col">
          <article className="card card-metric">
            <span className="metric-label">Total Events</span>
            <span className="metric-value">{summary.total}</span>
            <span className="metric-sublabel">Scheduled items</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Payroll Items</span>
            <span className="metric-value">{summary.payroll}</span>
            <span className="metric-sublabel">Runs and cycles</span>
          </article>
          <article className="card card-metric">
            <span className="metric-label">Deadlines</span>
            <span className="metric-value">{summary.deadlines}</span>
            <span className="metric-sublabel">Compliance dates</span>
          </article>
        </div>

        {/* Calendar Controls */}
        <div className="panel panel-elevated">
          <div className="panel-header">
            <h2>Calendar View</h2>
          </div>
          <div className="calendar-controls">
            <div className="calendar-nav">
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => navigateMonth(-1)}
              >
                <svg viewBox="0 0 24 24">
                  <polyline points="15,18 9,12 15,6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Previous
              </button>
              <h3 className="calendar-month">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => navigateMonth(1)}
              >
                Next
                <svg viewBox="0 0 24 24">
                  <polyline points="9,18 15,12 9,6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            
            <div className="calendar-actions">
              <select 
                value={viewMode} 
                onChange={(e) => setViewMode(e.target.value as "month" | "week" | "day")}
                className="btn btn-secondary btn-sm"
              >
                <option value="month">Month View</option>
                <option value="week">Week View</option>
                <option value="day">Day View</option>
              </select>
              
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </button>
            </div>
          </div>
        </div>

        <div className="calendar-layout">
          <div className="calendar-main panel panel-elevated calendar-panel">
            <div className="calendar-grid">
              <div className="calendar-weekdays">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="calendar-weekday">{day}</div>
                ))}
              </div>
              <div className="calendar-days">
                {getDaysInMonth(currentDate).map((date, index) => (
                  <div 
                    key={index} 
                    className={`calendar-day ${date ? 'has-date' : 'empty'} ${
                      date && date.toDateString() === new Date().toDateString() ? 'today' : ''
                    }`}
                    onClick={() => date && setSelectedDate(date)}
                  >
                    {date && (
                      <>
                        <div className="calendar-date-number">{date.getDate()}</div>
                        <div className="calendar-events">
                          {getEventsForDate(date).slice(0, 3).map((event, eventIndex) => (
                            <div 
                              key={eventIndex} 
                              className={`calendar-event-dot ${getEventColor(event.type)}`}
                              title={event.title}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="calendar-side">
            {/* Today's Events */}
            <div className="panel panel-elevated">
            <div className="panel-header">
              <h3>Today's Events</h3>
              <span className="event-count">{todayEvents.length}</span>
            </div>
            {todayEvents.length === 0 ? (
              <div className="empty-state">
                <p>No events scheduled for today</p>
              </div>
            ) : (
              <div className="events-list">
                {todayEvents.map(event => (
                  <div key={event.id} className="event-item">
                    <div className="event-icon">
                      {getEventIcon(event.type)}
                    </div>
                    <div className="event-content">
                      <h4>{event.title}</h4>
                      <p>{event.description}</p>
                      <div className="event-meta">
                        <span className="event-time">{event.time}</span>
                        <span className={`status-badge ${getStatusColor(event.status)}`}>
                          {event.status}
                        </span>
                      </div>
                    </div>
                    <button 
                      className="event-action"
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowEventDetails(true);
                      }}
                    >
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="1" fill="currentColor" />
                        <circle cx="12" cy="5" r="1" fill="currentColor" />
                        <circle cx="12" cy="19" r="1" fill="currentColor" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

            {/* Upcoming Events */}
            <div className="panel panel-elevated">
            <div className="panel-header">
              <h3>Upcoming Events</h3>
              <span className="event-count">{upcomingEvents.length}</span>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="empty-state">
                <p>No upcoming events</p>
              </div>
            ) : (
              <div className="events-list">
                {upcomingEvents.map(event => (
                  <div key={event.id} className="event-item">
                    <div className="event-icon">
                      {getEventIcon(event.type)}
                    </div>
                    <div className="event-content">
                      <h4>{event.title}</h4>
                      <p>{event.description}</p>
                      <div className="event-meta">
                        <span className="event-date">
                          {new Date(event.date).toLocaleDateString()}
                        </span>
                        <span className="event-time">{event.time}</span>
                      </div>
                    </div>
                    <button 
                      className="event-action"
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowEventDetails(true);
                      }}
                    >
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="1" fill="currentColor" />
                        <circle cx="12" cy="5" r="1" fill="currentColor" />
                        <circle cx="12" cy="19" r="1" fill="currentColor" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Events Table */}
        <div className="panel panel-elevated">
          <div className="panel-header">
            <h2>All Events</h2>
            <div className="filter-controls">
              <div className="form-group">
                <label htmlFor="searchEvents">Search</label>
                <div className="search-input-wrapper">
                  <svg viewBox="0 0 24 24" className="search-icon">
                    <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M21 21l-4.35-4.35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input
                    id="searchEvents"
                    type="text"
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="filterType">Event Type</label>
                <select 
                  id="filterType" 
                  value={filterType} 
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="payroll">Payroll</option>
                  <option value="holiday">Holiday</option>
                  <option value="meeting">Meeting</option>
                  <option value="deadline">Deadline</option>
                  <option value="reminder">Reminder</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <p>Loading events...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" className="empty-icon">
                <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" />
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" />
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <p>No events found matching your criteria.</p>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterType("all");
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <div className="event-info">
                          <div className={`event-icon ${getEventColor(event.type)}`}>
                            {getEventIcon(event.type)}
                          </div>
                          <div className="event-details">
                            <h4>{event.title}</h4>
                            <p>{event.description}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`event-type-badge ${getEventColor(event.type)}`}>
                          {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span className="date">{new Date(event.date).toLocaleDateString()}</span>
                      </td>
                      <td>
                        <span className="time">{event.time}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusColor(event.status)}`}>
                          {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="action-btn edit-btn"
                            onClick={() => {
                              setSelectedEvent(event);
                              setShowEventDetails(true);
                            }}
                            title="View Details"
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Event Details Modal */}
        {showEventDetails && selectedEvent && (
          <div className="modal-backdrop" onClick={() => setShowEventDetails(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Event Details</h3>
                <button className="modal-close" onClick={() => setShowEventDetails(false)}>
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <div className="event-details">
                  <div className="detail-row">
                    <span className="detail-label">Title:</span>
                    <span className="detail-value">{selectedEvent.title}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Description:</span>
                    <span className="detail-value">{selectedEvent.description}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Type:</span>
                    <span className={`event-type-badge ${getEventColor(selectedEvent.type)}`}>
                      {selectedEvent.type.charAt(0).toUpperCase() + selectedEvent.type.slice(1)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Date:</span>
                    <span className="detail-value">{new Date(selectedEvent.date).toLocaleDateString()}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Time:</span>
                    <span className="detail-value">{selectedEvent.time}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Status:</span>
                    <span className={`status-badge ${getStatusColor(selectedEvent.status)}`}>
                      {selectedEvent.status.charAt(0).toUpperCase() + selectedEvent.status.slice(1)}
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
