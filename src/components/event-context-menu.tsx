"use client";

import { useEffect, useRef } from "react";

export type RescheduleWhen = "sooner" | "today" | "this_week" | "this_month";

interface EventContextMenuProps {
  x: number;
  y: number;
  status: "scheduled" | "in_progress" | "completed";
  hasTask?: boolean;
  isLocked?: boolean;
  onStartTask: () => void;
  onStopTask: () => void;
  onMarkComplete: () => void;
  onReschedule: (when: RescheduleWhen) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function EventContextMenu({
  x,
  y,
  status,
  hasTask,
  isLocked,
  onStartTask,
  onStopTask,
  onMarkComplete,
  onReschedule,
  onDelete,
  onClose,
}: EventContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const el = ref.current;
    if (rect.right > window.innerWidth) {
      el.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, []);

  return (
    <div
      ref={ref}
      className="fixed z-[60] min-w-[180px] bg-[#1e1e30] border border-[#2a2a3c] rounded-lg shadow-2xl py-1"
      style={{ left: x, top: y }}
    >
      {status === "scheduled" && (
        <button
          onClick={() => { onStartTask(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-emerald-400">
            <polygon points="4,2 12,7 4,12" fill="currentColor" />
          </svg>
          Start Task
        </button>
      )}
      {status === "in_progress" && (
        <>
          <button
            onClick={() => { onStopTask(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-amber-400">
              <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" />
            </svg>
            Stop Task
          </button>
          <button
            onClick={() => { onMarkComplete(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-emerald-400">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4.5 7l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Mark Complete
          </button>
        </>
      )}
      {status === "completed" && (
        <button
          onClick={() => { onStartTask(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-400">
            <path d="M2 7h10M7 2v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Revert to Scheduled
        </button>
      )}

      {/* Reschedule for later — available for scheduled tasks */}
      {hasTask && status === "scheduled" && (
        <>
          <div className="h-px bg-[#2a2a3c] my-1" />
          <button
            onClick={() => { onReschedule("sooner"); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-emerald-400">
              <path d="M7 12.5V4M7 4l-3 3M7 4l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 1.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Reschedule Sooner
          </button>
          <div className="h-px bg-[#2a2a3c] my-1" />
          <div className="px-2.5 py-1.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Do it later
          </div>
          <button
            onClick={() => { onReschedule("today"); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-amber-400">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 3.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Later Today
          </button>
          <button
            onClick={() => { onReschedule("this_week"); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-blue-400">
              <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1.5 5.5h11" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4.5 1v2.5M9.5 1v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Later This Week
          </button>
          <button
            onClick={() => { onReschedule("this_month"); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-purple-400">
              <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1.5 5.5h11" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4.5 1v2.5M9.5 1v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="7" cy="8.5" r="1.5" fill="currentColor" className="text-purple-400" />
            </svg>
            Later This Month
          </button>
        </>
      )}

      {/* Delete */}
      <div className="h-px bg-[#2a2a3c] my-1" />
      <button
        onClick={() => { onDelete(); onClose(); }}
        disabled={isLocked}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-red-400">
          <path d="M3 3.5h8M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M4.5 3.5l.5 8h4l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {isLocked ? "Locked" : "Delete"}
      </button>
    </div>
  );
}
