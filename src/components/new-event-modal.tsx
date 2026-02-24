"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface NewEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultDate?: string; // YYYY-MM-DD
}

const COLOR_OPTIONS = [
  { value: "indigo", label: "Focus", bg: "bg-indigo-500", ring: "ring-indigo-400" },
  { value: "emerald", label: "Light", bg: "bg-emerald-500", ring: "ring-emerald-400" },
  { value: "amber", label: "Admin", bg: "bg-amber-500", ring: "ring-amber-400" },
  { value: "gray", label: "Other", bg: "bg-slate-500", ring: "ring-slate-400" },
];

function getDefaultTimes(): { startTime: string; endTime: string } {
  const now = new Date();
  // Round up to next hour
  const startHour = now.getMinutes() > 0 ? now.getHours() + 1 : now.getHours();
  const clamped = Math.min(Math.max(startHour, 6), 22);
  const endHour = Math.min(clamped + 1, 23);
  return {
    startTime: `${String(clamped).padStart(2, "0")}:00`,
    endTime: `${String(endHour).padStart(2, "0")}:00`,
  };
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Generate time options in 15-minute increments
function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

function formatTimeLabel(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === "00" ? `${hour} ${ampm}` : `${hour}:${m} ${ampm}`;
}

const TIME_OPTIONS = generateTimeOptions();

export function NewEventModal({ isOpen, onClose, onCreated, defaultDate }: NewEventModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate || getTodayStr());
  const defaults = getDefaultTimes();
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [color, setColor] = useState("indigo");
  const [addToGoogle, setAddToGoogle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDate(defaultDate || getTodayStr());
      const d = getDefaultTimes();
      setStartTime(d.startTime);
      setEndTime(d.endTime);
      setColor("indigo");
      setAddToGoogle(false);
      setError("");
      setSubmitting(false);
      // Focus title input after a small delay for animation
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultDate]);

  // Escape key to close
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) {
        setError("Title is required");
        return;
      }
      if (startTime >= endTime) {
        setError("End time must be after start time");
        return;
      }

      setSubmitting(true);
      setError("");

      try {
        const startISO = new Date(`${date}T${startTime}:00`).toISOString();
        const endISO = new Date(`${date}T${endTime}:00`).toISOString();

        const res = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            date,
            startTime: startISO,
            endTime: endISO,
            color,
            addToGoogle,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create event");
        }

        onCreated();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [title, date, startTime, endTime, color, addToGoogle, onCreated, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">New Event</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Title</label>
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event name..."
            className="w-full rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors [color-scheme:dark]"
          />
        </div>

        {/* Time row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Start Time</label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors [color-scheme:dark]"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {formatTimeLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">End Time</label>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors [color-scheme:dark]"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {formatTimeLabel(t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Color</label>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColor(opt.value)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
                  color === opt.value
                    ? `${opt.bg} text-white ring-2 ${opt.ring} ring-offset-1 ring-offset-[#1e1e30]`
                    : `bg-[#2a2a3c] text-gray-400 hover:text-gray-200 hover:bg-[#3a3a4c]`
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${opt.bg}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Add to Google */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <div
            className={`relative w-9 h-5 rounded-full transition-colors ${
              addToGoogle ? "bg-indigo-500" : "bg-[#2a2a3c]"
            }`}
            onClick={() => setAddToGoogle(!addToGoogle)}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                addToGoogle ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
          <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
            Add to Google Calendar
          </span>
        </label>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {submitting && (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {submitting ? "Creating..." : "Create Event"}
          </button>
        </div>
      </form>
    </div>
  );
}
