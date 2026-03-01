"use client";

import { useEffect, useRef } from "react";

interface EventContextMenuProps {
  x: number;
  y: number;
  status: "scheduled" | "in_progress" | "completed";
  hasTask?: boolean;
  onStartTask: () => void;
  onStopTask: () => void;
  onMarkComplete: () => void;
  onReschedule: () => void;
  onClose: () => void;
}

export function EventContextMenu({
  x,
  y,
  status,
  hasTask,
  onStartTask,
  onStopTask,
  onMarkComplete,
  onReschedule,
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
            onClick={() => { onReschedule(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-blue-400">
              <path d="M7 1v4l3 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12.5 7A5.5 5.5 0 111.5 7a5.5 5.5 0 0111 0z" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Reschedule for Later
          </button>
        </>
      )}
    </div>
  );
}
