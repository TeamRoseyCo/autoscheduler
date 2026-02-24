"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ScheduledBlock } from "@/generated/prisma/client";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightPanel } from "@/components/right-panel";
import { NewEventModal } from "@/components/new-event-modal";
import { SearchModal } from "@/components/search-modal";
import { scheduleTodayAction } from "@/lib/actions/schedule";

const HOUR_HEIGHT = 64;
const START_HOUR = 5;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---- Unified CalendarEventData ----

export interface CalendarEventData {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  color: string;
  source: "local" | "google";
  googleEventId?: string;
  taskId?: string;
}

// ---- Utilities ----

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const d = new Date(baseDate);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function formatShortTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function blocksToEvents(blocks: ScheduledBlock[]): CalendarEventData[] {
  return blocks.map((b) => ({
    id: b.id,
    title: b.title,
    startTime: typeof b.startTime === "string" ? b.startTime : new Date(b.startTime).toISOString(),
    endTime: typeof b.endTime === "string" ? b.endTime : new Date(b.endTime).toISOString(),
    date: b.date,
    color: b.color,
    source: "local" as const,
    googleEventId: b.googleEventId || undefined,
    taskId: b.taskId || undefined,
  }));
}

function mergeEvents(
  localEvents: CalendarEventData[],
  googleEvents: CalendarEventData[]
): CalendarEventData[] {
  // Build a set of googleEventIds from local events for de-duplication
  const localGoogleIds = new Set<string>();
  for (const ev of localEvents) {
    if (ev.googleEventId) localGoogleIds.add(ev.googleEventId);
  }

  // Filter out Google events that already have a local counterpart
  const dedupedGoogle = googleEvents.filter(
    (ev) => !ev.googleEventId || !localGoogleIds.has(ev.googleEventId)
  );

  return [...localEvents, ...dedupedGoogle];
}

// ---- Color Styles (dark theme) ----

const EVENT_COLORS: Record<string, { bg: string; border: string; text: string; sub: string; dot: string }> = {
  indigo: {
    bg: "bg-indigo-500/20",
    border: "border-l-indigo-400",
    text: "text-indigo-200",
    sub: "text-indigo-300/60",
    dot: "bg-indigo-400",
  },
  emerald: {
    bg: "bg-emerald-500/20",
    border: "border-l-emerald-400",
    text: "text-emerald-200",
    sub: "text-emerald-300/60",
    dot: "bg-emerald-400",
  },
  amber: {
    bg: "bg-amber-500/20",
    border: "border-l-amber-400",
    text: "text-amber-200",
    sub: "text-amber-300/60",
    dot: "bg-amber-400",
  },
  gray: {
    bg: "bg-slate-500/20",
    border: "border-l-slate-400",
    text: "text-slate-200",
    sub: "text-slate-300/60",
    dot: "bg-slate-400",
  },
};

// ---- Sub-Components ----

function CalendarEvent({
  event,
  onClick,
}: {
  event: CalendarEventData;
  onClick: (event: CalendarEventData, rect: DOMRect) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  const startH = start.getHours() + start.getMinutes() / 60;
  const endH = end.getHours() + end.getMinutes() / 60;

  const clampedStart = Math.max(startH, START_HOUR);
  const clampedEnd = Math.min(endH, END_HOUR);
  if (clampedEnd <= clampedStart) return null;

  const top = (clampedStart - START_HOUR) * HOUR_HEIGHT;
  const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT - 2, 20);

  const colors = EVENT_COLORS[event.color] || EVENT_COLORS.gray;
  const showTime = height > 34;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (elRef.current) {
      onClick(event, elRef.current.getBoundingClientRect());
    }
  };

  return (
    <div
      ref={elRef}
      className={`absolute left-1 right-1 rounded-md border-l-[3px] ${colors.border} ${colors.bg} px-2 py-1 overflow-hidden cursor-pointer hover:brightness-125 hover:shadow-lg transition-all group`}
      style={{ top: `${top}px`, height: `${height}px` }}
      title={`${event.title}\n${formatShortTime(start)} - ${formatShortTime(end)}`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-1.5">
        <div className={`w-3 h-3 rounded-full border-[1.5px] ${colors.border.replace("border-l-", "border-")} flex-shrink-0 mt-0.5 group-hover:border-white/50 transition-colors`} />
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-medium leading-tight truncate ${colors.text}`}>
            {event.title}
          </p>
          {showTime && (
            <p className={`text-[10px] mt-0.5 truncate ${colors.sub}`}>
              {formatShortTime(start)} - {formatShortTime(end)}
            </p>
          )}
        </div>
        {event.source === "google" && (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5 opacity-40">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>
    </div>
  );
}

function EventPopover({
  event,
  position,
  onClose,
}: {
  event: CalendarEventData;
  position: { top: number; left: number };
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const colors = EVENT_COLORS[event.color] || EVENT_COLORS.gray;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Clamp position to viewport
  const clampedTop = Math.min(position.top, window.innerHeight - 200);
  const clampedLeft = Math.min(position.left, window.innerWidth - 280);

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-64 bg-[#1e1e30] border border-[#2a2a3c] rounded-lg shadow-2xl p-4 space-y-2"
      style={{ top: `${clampedTop}px`, left: `${clampedLeft}px` }}
    >
      <div className="flex items-start gap-2">
        <div className={`w-3 h-3 rounded-full ${colors.dot} flex-shrink-0 mt-0.5`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-100 leading-tight">{event.title}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-0.5 -mr-1 -mt-0.5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="text-xs text-gray-400 space-y-1 pl-5">
        <p>{formatShortTime(event.startTime)} - {formatShortTime(event.endTime)}</p>
        <p className="text-gray-500">
          {new Date(event.date + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <div className="flex items-center gap-1.5 pt-1">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
            event.source === "google"
              ? "bg-slate-500/20 text-slate-300"
              : "bg-indigo-500/20 text-indigo-300"
          }`}>
            {event.source === "google" ? "Google Calendar" : "Local"}
          </span>
        </div>
      </div>
    </div>
  );
}

function CurrentTimeIndicator() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const hours = now.getHours() + now.getMinutes() / 60;
  if (hours < START_HOUR || hours > END_HOUR) return null;

  const top = (hours - START_HOUR) * HOUR_HEIGHT;

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${top}px` }}>
      <div className="relative flex items-center">
        <div className="absolute -left-[5px] w-[10px] h-[10px] rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
        <div className="w-full h-[2px] bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.3)]" />
      </div>
    </div>
  );
}

// ---- Inline SVG Icons ----

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 8a5.5 5.5 0 019.66-3.5M13.5 8a5.5 5.5 0 01-9.66 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.16 1v3.5h-3.5M3.84 15v-3.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 8h8M8 4v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ---- Toast Component ----

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-[#2a2a3c] border border-[#3a3a4c] text-sm text-gray-300 px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-amber-400 flex-shrink-0">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {message}
      <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 ml-2">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ---- Main Component ----

interface WeekCalendarProps {
  initialBlocks: ScheduledBlock[];
  initialDate: string;
}

export function WeekCalendar({ initialBlocks, initialDate }: WeekCalendarProps) {
  const [localEvents, setLocalEvents] = useState<CalendarEventData[]>(() =>
    blocksToEvents(initialBlocks)
  );
  const [googleEvents, setGoogleEvents] = useState<CalendarEventData[]>([]);
  const [currentDate, setCurrentDate] = useState(() => new Date(initialDate + "T12:00:00"));
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("calendar-sidebar-open");
      return stored === null ? true : stored === "true";
    }
    return true;
  });
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [showGoogleEvents, setShowGoogleEvents] = useState(true);
  const [showLocalEvents, setShowLocalEvents] = useState(true);
  const [newEventModalOpen, setNewEventModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [popover, setPopover] = useState<{ event: CalendarEventData; position: { top: number; left: number } } | null>(null);

  const weekDates = getWeekDates(currentDate);
  const todayKey = dateToKey(new Date());

  // Persist sidebar preference
  useEffect(() => {
    localStorage.setItem("calendar-sidebar-open", String(sidebarOpen));
  }, [sidebarOpen]);

  // Merge and filter events
  const allEvents = mergeEvents(
    showLocalEvents ? localEvents : [],
    showGoogleEvents ? googleEvents : []
  );

  // Group events by date
  const eventsByDate: Record<string, CalendarEventData[]> = {};
  for (const ev of allEvents) {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  }

  // Fetch local blocks
  const fetchLocalBlocks = useCallback(async (dates: Date[]) => {
    const startDate = dateToKey(dates[0]);
    const endDate = dateToKey(dates[6]);
    try {
      const res = await fetch(`/api/calendar/blocks?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const blocks: ScheduledBlock[] = await res.json();
        setLocalEvents(blocksToEvents(blocks));
      }
    } catch {
      // Silently fail for local blocks
    }
  }, []);

  // Fetch Google events
  const fetchGoogleEvents = useCallback(async (dates: Date[]) => {
    const startDate = dateToKey(dates[0]);
    const endDate = dateToKey(dates[6]);
    try {
      const res = await fetch(`/api/calendar/google-events?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const events: CalendarEventData[] = await res.json();
        setGoogleEvents(events);
      } else {
        setToastMessage("Could not load Google Calendar events");
      }
    } catch {
      setToastMessage("Could not load Google Calendar events");
    }
  }, []);

  // Fetch all events
  const fetchAllEvents = useCallback(
    async (dates: Date[]) => {
      setLoading(true);
      await Promise.all([fetchLocalBlocks(dates), fetchGoogleEvents(dates)]);
      setLoading(false);
    },
    [fetchLocalBlocks, fetchGoogleEvents]
  );

  // Initial fetch for Google events (local blocks come from SSR)
  useEffect(() => {
    fetchGoogleEvents(weekDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigation
  const goToWeek = useCallback(
    (offset: number) => {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + offset * 7);
      setCurrentDate(d);
      fetchAllEvents(getWeekDates(d));
    },
    [currentDate, fetchAllEvents]
  );

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    fetchAllEvents(getWeekDates(today));
  }, [fetchAllEvents]);

  const handleDateSelect = useCallback(
    (date: Date) => {
      setCurrentDate(date);
      fetchAllEvents(getWeekDates(date));
    },
    [fetchAllEvents]
  );

  const handleRefresh = useCallback(() => {
    fetchAllEvents(weekDates);
  }, [fetchAllEvents, weekDates]);

  const handleScheduleDay = useCallback(async () => {
    setScheduling(true);
    try {
      await scheduleTodayAction();
      await fetchAllEvents(weekDates);
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : "Scheduling failed");
    } finally {
      setScheduling(false);
    }
  }, [fetchAllEvents, weekDates]);

  const handleEventCreated = useCallback(() => {
    fetchAllEvents(weekDates);
  }, [fetchAllEvents, weekDates]);

  const handleEventClick = useCallback(
    (event: CalendarEventData, rect: DOMRect) => {
      setPopover({
        event,
        position: { top: rect.top, left: rect.right + 8 },
      });
    },
    []
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Scroll to 7 AM on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (7 - START_HOUR) * HOUR_HEIGHT;
    }
  }, []);

  // Header text
  const first = weekDates[0];
  const last = weekDates[6];
  const headerText =
    first.getMonth() === last.getMonth()
      ? `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`
      : `${MONTH_NAMES[first.getMonth()]} – ${MONTH_NAMES[last.getMonth()]} ${first.getFullYear()}`;

  return (
    <div className="flex h-full bg-[#12121c]">
      {/* Left Sidebar */}
      {sidebarOpen && (
        <LeftSidebar
          collapsed={false}
          onToggle={() => setSidebarOpen(false)}
          onSearchClick={() => setSearchModalOpen(true)}
        />
      )}
      {!sidebarOpen && (
        <LeftSidebar
          collapsed={true}
          onToggle={() => setSidebarOpen(true)}
          onSearchClick={() => setSearchModalOpen(true)}
        />
      )}

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#16161f] border-b border-[#2a2a3c] flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-200 bg-[#2a2a3c] hover:bg-[#3a3a4c] transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => goToWeek(-1)}
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors"
            >
              <ChevronLeft />
            </button>
            <button
              onClick={() => goToWeek(1)}
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors"
            >
              <ChevronRight />
            </button>
            <h2 className="text-lg font-semibold text-gray-100 ml-1">{headerText}</h2>
            {(loading || scheduling) && (
              <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleScheduleDay}
              disabled={scheduling}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Schedule today with AI"
            >
              <ScheduleIcon />
              <span className="hidden sm:inline">Schedule Day</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh events"
            >
              <RefreshIcon />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setNewEventModalOpen(true)}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-200 bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-1.5"
            >
              <PlusIcon />
              New
            </button>
            <div className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-300 bg-[#2a2a3c] flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M1 6.5h14" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Week
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="ml-0.5">
                <path d="M3 4l2 2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {rightPanelOpen ? (
              <button
                onClick={() => setRightPanelOpen(false)}
                className="rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors flex items-center gap-1"
                title="Close side panel"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => setRightPanelOpen(true)}
                className="rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors flex items-center gap-1"
                title="Open side panel"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 4L2 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Day Headers */}
        <div className="flex bg-[#16161f] border-b border-[#2a2a3c] flex-shrink-0">
          {/* Time gutter spacer */}
          <div className="w-[60px] flex-shrink-0 flex items-center justify-center">
            <span className="text-[10px] text-gray-600 font-medium">GMT+</span>
          </div>
          {weekDates.map((date, i) => {
            const key = dateToKey(date);
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 border-l border-[#2a2a3c] ${
                  isToday ? "bg-[#1a1a30]" : ""
                }`}
              >
                <span className={`text-xs font-medium uppercase tracking-wide ${isToday ? "text-blue-400" : "text-gray-500"}`}>
                  {DAY_NAMES_SHORT[i]}
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday ? "bg-blue-500 text-white" : "text-gray-300"
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scrollable Time Grid */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
            {/* Time gutter */}
            <div className="w-[60px] flex-shrink-0 relative bg-[#12121c] sticky left-0 z-10">
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={i}
                  className="absolute right-3 text-[11px] text-gray-600 leading-none select-none"
                  style={{ top: `${i * HOUR_HEIGHT - 7}px` }}
                >
                  {i > 0 ? formatHour(START_HOUR + i) : ""}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDates.map((date) => {
              const key = dateToKey(date);
              const isToday = key === todayKey;
              const dayEvents = eventsByDate[key] || [];

              return (
                <div
                  key={key}
                  className={`flex-1 relative border-l border-[#2a2a3c] min-w-0 ${
                    isToday ? "bg-[#161628]" : ""
                  }`}
                >
                  {/* Hour lines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div
                      key={`h-${i}`}
                      className="absolute left-0 right-0 border-t border-[#222235]"
                      style={{ top: `${i * HOUR_HEIGHT}px` }}
                    />
                  ))}
                  {/* Half-hour lines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div
                      key={`hh-${i}`}
                      className="absolute left-0 right-0 border-t border-[#1a1a2a]"
                      style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                    />
                  ))}

                  {/* Events */}
                  {dayEvents.map((event) => (
                    <CalendarEvent
                      key={event.id}
                      event={event}
                      onClick={handleEventClick}
                    />
                  ))}

                  {/* Current time */}
                  {isToday && <CurrentTimeIndicator />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      {rightPanelOpen && (
        <RightPanel
          onDateSelect={handleDateSelect}
          selectedDate={currentDate}
          onClose={() => setRightPanelOpen(false)}
          showGoogleEvents={showGoogleEvents}
          onToggleGoogleEvents={() => setShowGoogleEvents((v) => !v)}
          showLocalEvents={showLocalEvents}
          onToggleLocalEvents={() => setShowLocalEvents((v) => !v)}
        />
      )}

      {/* Event Popover */}
      {popover && (
        <EventPopover
          event={popover.event}
          position={popover.position}
          onClose={() => setPopover(null)}
        />
      )}

      {/* New Event Modal */}
      <NewEventModal
        isOpen={newEventModalOpen}
        onClose={() => setNewEventModalOpen(false)}
        onCreated={handleEventCreated}
        defaultDate={dateToKey(currentDate)}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        events={allEvents}
        onNavigateToDate={handleDateSelect}
      />

      {/* Toast */}
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  );
}
