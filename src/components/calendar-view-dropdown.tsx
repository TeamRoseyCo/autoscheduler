"use client";

import { useState, useEffect, useRef } from "react";
import type { CalendarViewMode } from "@/types";

interface CalendarViewDropdownProps {
  view: CalendarViewMode;
  onChange: (view: CalendarViewMode) => void;
}

const VIEW_OPTIONS: { value: CalendarViewMode; label: string; shortcut?: string }[] = [
  { value: "day", label: "Day", shortcut: "D" },
  { value: "4day", label: "4 Day", shortcut: "X" },
  { value: "week", label: "Week", shortcut: "W" },
  { value: "month", label: "Month", shortcut: "M" },
];

const VIEW_LABELS: Record<CalendarViewMode, string> = {
  day: "Day",
  "4day": "4 Day",
  week: "Week",
  month: "Month",
};

export function CalendarViewDropdown({ view, onChange }: CalendarViewDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-300 bg-[#2a2a3c] hover:bg-[#3a3a4c] transition-colors flex items-center gap-1.5"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="3" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 6.5h14" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {VIEW_LABELS[view]}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="ml-0.5">
          <path d="M3 4l2 2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-[#1e1e30] border border-[#2a2a3c] rounded-lg shadow-xl z-50 py-1">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                view === opt.value
                  ? "text-indigo-300 bg-indigo-500/10"
                  : "text-gray-300 hover:bg-[#2a2a3c]"
              }`}
            >
              <span>{opt.label}</span>
              {opt.shortcut && (
                <span className="text-[10px] text-gray-600 bg-[#2a2a3c] px-1.5 py-0.5 rounded">{opt.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
