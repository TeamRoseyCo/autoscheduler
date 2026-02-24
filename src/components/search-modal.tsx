"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface CalendarEventData {
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

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEventData[];
  onNavigateToDate: (date: Date) => void;
}

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAY_NAMES_SHORT[d.getDay()]}, ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function formatShortTime(isoStr: string): string {
  const d = new Date(isoStr);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

const EVENT_COLOR_DOT: Record<string, string> = {
  indigo: "bg-indigo-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  gray: "bg-slate-400",
};

export function SearchModal({ isOpen, onClose, events, onNavigateToDate }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Reset and focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose]
  );

  const filteredEvents = useMemo(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return events
      .filter((ev) => ev.title.toLowerCase().includes(lower))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [query, events]);

  const handleEventClick = useCallback(
    (ev: CalendarEventData) => {
      const d = new Date(ev.date + "T12:00:00");
      onNavigateToDate(d);
      onClose();
    },
    [onNavigateToDate, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-lg bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a3c]">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 text-gray-500">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-xs text-gray-600 bg-[#2a2a3c] px-2 py-0.5 rounded hover:text-gray-400 transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {query.trim() && filteredEvents.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-600">
              No events matching &ldquo;{query}&rdquo;
            </div>
          )}

          {filteredEvents.map((ev) => (
            <button
              key={ev.id}
              onClick={() => handleEventClick(ev)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#252540] transition-colors border-b border-[#2a2a3c]/50 last:border-b-0"
            >
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${EVENT_COLOR_DOT[ev.color] || EVENT_COLOR_DOT.gray}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-200 truncate">{ev.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatEventDate(ev.date)} &middot; {formatShortTime(ev.startTime)} - {formatShortTime(ev.endTime)}
                  {ev.source === "google" && (
                    <span className="ml-1.5 text-gray-600">(Google)</span>
                  )}
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 text-gray-600">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}

          {!query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-gray-600">
              Type to search events by title
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
