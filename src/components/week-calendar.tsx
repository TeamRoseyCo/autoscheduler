"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ScheduledBlock } from "@/generated/prisma/client";

const HOUR_HEIGHT = 64;
const START_HOUR = 5;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR;

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const d = new Date(baseDate);
  // Set to Sunday of the week
  const day = d.getDay();
  d.setDate(d.getDate() - day);
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

function formatTimeFromDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  indigo: {
    bg: "bg-indigo-500/70",
    border: "border-indigo-400/50",
    text: "text-indigo-100",
  },
  emerald: {
    bg: "bg-emerald-600/70",
    border: "border-emerald-500/50",
    text: "text-emerald-100",
  },
  amber: {
    bg: "bg-amber-600/70",
    border: "border-amber-500/50",
    text: "text-amber-100",
  },
  gray: {
    bg: "bg-slate-600/70",
    border: "border-slate-500/50",
    text: "text-slate-100",
  },
};

function CalendarEvent({ block }: { block: ScheduledBlock }) {
  const start = new Date(block.startTime);
  const end = new Date(block.endTime);

  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;

  const clampedStart = Math.max(startHour, START_HOUR);
  const clampedEnd = Math.min(endHour, END_HOUR);

  if (clampedEnd <= clampedStart) return null;

  const top = (clampedStart - START_HOUR) * HOUR_HEIGHT;
  const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT - 2, 18);

  const colors = COLOR_MAP[block.color] || COLOR_MAP.gray;
  const showTime = height > 36;

  return (
    <div
      className={`absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden cursor-default border ${colors.bg} ${colors.border}`}
      style={{ top: `${top}px`, height: `${height}px` }}
    >
      <p className={`text-xs font-medium truncate ${colors.text}`}>
        {block.title}
      </p>
      {showTime && (
        <p className={`text-[10px] truncate ${colors.text} opacity-75`}>
          {formatTimeFromDate(start)} - {formatTimeFromDate(end)}
        </p>
      )}
    </div>
  );
}

function CurrentTimeIndicator() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const hours = now.getHours() + now.getMinutes() / 60;
  if (hours < START_HOUR || hours > END_HOUR) return null;

  const top = (hours - START_HOUR) * HOUR_HEIGHT;

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${top}px` }}>
      <div className="relative flex items-center">
        <div className="absolute -left-[5px] w-[10px] h-[10px] rounded-full bg-red-500" />
        <div className="w-full h-[2px] bg-red-500" />
      </div>
    </div>
  );
}

// Inline SVG Chevrons
function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface WeekCalendarProps {
  initialBlocks: ScheduledBlock[];
  initialDate: string;
}

export function WeekCalendar({ initialBlocks, initialDate }: WeekCalendarProps) {
  const [blocks, setBlocks] = useState<ScheduledBlock[]>(initialBlocks);
  const [currentDate, setCurrentDate] = useState(() => new Date(initialDate + "T12:00:00"));
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekDates = getWeekDates(currentDate);
  const todayKey = dateToKey(new Date());

  // Group blocks by date
  const blocksByDate: Record<string, ScheduledBlock[]> = {};
  for (const block of blocks) {
    const key = block.date;
    if (!blocksByDate[key]) blocksByDate[key] = [];
    blocksByDate[key].push(block);
  }

  const fetchBlocks = useCallback(async (dates: Date[]) => {
    const startDate = dateToKey(dates[0]);
    const endDate = dateToKey(dates[6]);
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/blocks?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        setBlocks(data);
      }
    } catch {
      // Silently fail on network error
    } finally {
      setLoading(false);
    }
  }, []);

  const goToWeek = useCallback(
    (offset: number) => {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + offset * 7);
      setCurrentDate(newDate);
      const newWeekDates = getWeekDates(newDate);
      fetchBlocks(newWeekDates);
    },
    [currentDate, fetchBlocks]
  );

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    const newWeekDates = getWeekDates(today);
    fetchBlocks(newWeekDates);
  }, [fetchBlocks]);

  // Scroll to 8 AM on mount
  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = (8 - START_HOUR) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  // Month/year header text
  const firstDate = weekDates[0];
  const lastDate = weekDates[6];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  let headerText: string;
  if (firstDate.getMonth() === lastDate.getMonth()) {
    headerText = `${monthNames[firstDate.getMonth()]} ${firstDate.getFullYear()}`;
  } else if (firstDate.getFullYear() === lastDate.getFullYear()) {
    headerText = `${monthNames[firstDate.getMonth()]} - ${monthNames[lastDate.getMonth()]} ${firstDate.getFullYear()}`;
  } else {
    headerText = `${monthNames[firstDate.getMonth()]} ${firstDate.getFullYear()} - ${monthNames[lastDate.getMonth()]} ${lastDate.getFullYear()}`;
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="h-full flex flex-col bg-[#12121c]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#16161f] border-b border-[#2a2a3a]">
        <button
          onClick={goToToday}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-200 bg-[#2a2a3a] hover:bg-[#3a3a4a] transition-colors"
        >
          Today
        </button>
        <button
          onClick={() => goToWeek(-1)}
          className="rounded-md p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3a] transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={() => goToWeek(1)}
          className="rounded-md p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3a] transition-colors"
          aria-label="Next week"
        >
          <ChevronRight />
        </button>
        <h2 className="text-lg font-semibold text-gray-100">{headerText}</h2>
        {loading && (
          <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-gray-200" />
        )}
      </div>

      {/* Day headers */}
      <div className="flex bg-[#16161f] border-b border-[#2a2a3a]">
        {/* Time gutter spacer */}
        <div className="w-[60px] flex-shrink-0" />
        {weekDates.map((date, i) => {
          const key = dateToKey(date);
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className="flex-1 flex flex-col items-center py-2 border-l border-[#2a2a3a]"
            >
              <span className={`text-xs font-medium ${isToday ? "text-blue-400" : "text-gray-500"}`}>
                {dayNames[i]}
              </span>
              <span
                className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday
                    ? "bg-blue-500 text-white"
                    : "text-gray-300"
                }`}
              >
                {date.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
          {/* Time gutter */}
          <div className="w-[60px] flex-shrink-0 relative bg-[#1a1a2a] sticky left-0 z-10">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={i}
                className="absolute right-2 text-[11px] text-gray-500 leading-none"
                style={{ top: `${i * HOUR_HEIGHT - 6}px` }}
              >
                {i > 0 ? formatHour(START_HOUR + i) : ""}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date) => {
            const key = dateToKey(date);
            const isToday = key === todayKey;
            const dayBlocks = blocksByDate[key] || [];

            return (
              <div
                key={key}
                className={`flex-1 relative border-l border-[#2a2a3a] ${
                  isToday ? "bg-[#1e2035]" : ""
                }`}
              >
                {/* Hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={`h-${i}`}
                    className="absolute left-0 right-0 border-t border-[#2a2a3a]"
                    style={{ top: `${i * HOUR_HEIGHT}px` }}
                  />
                ))}
                {/* Half-hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={`hh-${i}`}
                    className="absolute left-0 right-0 border-t border-[#242433]"
                    style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                  />
                ))}

                {/* Events */}
                {dayBlocks.map((block) => (
                  <CalendarEvent key={block.id} block={block} />
                ))}

                {/* Current time indicator */}
                {isToday && <CurrentTimeIndicator />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
