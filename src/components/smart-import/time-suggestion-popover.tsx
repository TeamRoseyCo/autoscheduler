"use client";

import { useState, useEffect, useRef } from "react";

interface TimeSuggestion {
  date: string;
  startTime: string;
  endTime: string;
  label: string;
}

interface TimeSuggestionPopoverProps {
  eventId: string;
  eventType: string;
  date: string;
  onSelect: (date: string, startTime: string, endTime: string) => void;
  onClose: () => void;
}

export function TimeSuggestionPopover({
  eventId,
  eventType,
  date,
  onSelect,
  onClose,
}: TimeSuggestionPopoverProps) {
  const [suggestions, setSuggestions] = useState<TimeSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function fetchSuggestions() {
      try {
        const res = await fetch("/api/smart-import/suggest-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType, date }),
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!cancelled) {
          setSuggestions(data.suggestions || []);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSuggestions();
    return () => { cancelled = true; };
  }, [eventId, eventType, date]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 w-56 bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-xl overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-[#2a2a3c] flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        <span className="text-xs font-medium text-gray-300">Suggested times</span>
      </div>

      {loading ? (
        <div className="px-3 py-4 text-center">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-600 border-t-indigo-400 rounded-full" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="px-3 py-3 text-xs text-gray-500 text-center">
          No free slots found
        </div>
      ) : (
        <div className="py-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSelect(s.date, s.startTime, s.endTime)}
              className="w-full px-3 py-2 text-left hover:bg-[#2a2a3c] transition-colors flex items-center justify-between"
            >
              <div>
                <div className="text-xs text-gray-300">{s.label}</div>
                <div className="text-[11px] text-gray-500">
                  {s.date} {s.startTime} - {s.endTime}
                </div>
              </div>
              <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
