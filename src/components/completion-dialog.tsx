"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { CalendarEventData } from "@/components/week-calendar";

interface CompletionDialogProps {
  event: CalendarEventData | null;
  onClose: () => void;
  onConfirm: (data: {
    actualStartTime: string;
    actualEndTime: string;
    rescheduleRemaining: boolean;
    remainingMinutes: number;
    metricEntry?: { metricId: string; value: number; notes?: string } | null;
  }) => void;
}

function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function CompletionDialog({ event, onClose, onConfirm }: CompletionDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Pre-fill start from actualStartTime (if timer ran) or block startTime
  const defaultStart = event?.actualStartTime
    ? toHHMM(new Date(event.actualStartTime))
    : event ? toHHMM(new Date(event.startTime)) : "09:00";

  // Pre-fill end from current time, date from event
  const defaultEnd = toHHMM(new Date());
  const defaultDate = event?.date ?? toDateInput(new Date());

  const [actualDate, setActualDate] = useState(defaultDate);
  const [actualStart, setActualStart] = useState(defaultStart);
  const [actualEnd, setActualEnd] = useState(defaultEnd);
  const [reschedule, setReschedule] = useState(false);

  // Metric logging
  const [metricValue, setMetricValue] = useState("");
  const [metricNotes, setMetricNotes] = useState("");

  // Update defaults when event changes
  useEffect(() => {
    if (event) {
      const start = event.actualStartTime
        ? toHHMM(new Date(event.actualStartTime))
        : toHHMM(new Date(event.startTime));
      setActualDate(event.date);
      setActualStart(start);
      setActualEnd(toHHMM(new Date()));
      setReschedule(false);
      setMetricValue("");
      setMetricNotes("");
    }
  }, [event]);

  // Compute durations
  const plannedStart = event ? new Date(event.startTime) : new Date();
  const plannedEnd = event ? new Date(event.endTime) : new Date();
  const plannedMinutes = Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60000);

  // If end < start the session crossed midnight — add 24h to the end minutes
  const startM = hhmmToMinutes(actualStart);
  const endM = hhmmToMinutes(actualEnd);
  const actualMinutes = Math.max(0, endM < startM ? (endM + 24 * 60) - startM : endM - startM);
  const remainingMinutes = Math.max(0, plannedMinutes - actualMinutes);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!event) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [event, onClose]);

  const handleConfirm = () => {
    if (!event) return;
    // If end time is earlier than start time the session crossed midnight —
    // the end belongs to the following calendar day.
    const endDate =
      hhmmToMinutes(actualEnd) < hhmmToMinutes(actualStart)
        ? toDateInput(new Date(new Date(actualDate).getTime() + 86_400_000))
        : actualDate;

    const metricEntry =
      event.taskMetric && metricValue.trim()
        ? {
            metricId: event.taskMetric.id,
            value: parseFloat(metricValue),
            notes: metricNotes.trim() || undefined,
          }
        : null;

    onConfirm({
      actualStartTime: new Date(`${actualDate}T${actualStart}:00`).toISOString(),
      actualEndTime: new Date(`${endDate}T${actualEnd}:00`).toISOString(),
      rescheduleRemaining: reschedule && remainingMinutes > 0,
      remainingMinutes,
      metricEntry,
    });
  };

  if (!event) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-md bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">Complete Task</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Event title */}
        <p className="text-sm text-gray-400 truncate">{event.title}</p>

        {/* Date picker */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Date completed</label>
          <input
            type="date"
            value={actualDate}
            onChange={(e) => setActualDate(e.target.value)}
            className="w-full rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
          />
        </div>

        {/* Actual time pickers — free minute input */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Actual Start</label>
            <input
              type="time"
              value={actualStart}
              onChange={(e) => setActualStart(e.target.value)}
              className="w-full rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Actual End</label>
            <input
              type="time"
              value={actualEnd}
              onChange={(e) => setActualEnd(e.target.value)}
              className="w-full rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Duration comparison */}
        <div className="bg-[#12121c] border border-[#2a2a3c] rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Planned duration</span>
            <span className="text-gray-300">{plannedMinutes} min</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Actual duration</span>
            <span className="text-gray-300">{actualMinutes} min</span>
          </div>
          {remainingMinutes > 0 && (
            <div className="flex justify-between text-sm pt-1 border-t border-[#2a2a3c]">
              <span className="text-amber-400">Remaining</span>
              <span className="text-amber-300">{remainingMinutes} min</span>
            </div>
          )}
        </div>

        {/* Reschedule toggle */}
        {remainingMinutes > 0 && (
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              className={`relative w-9 h-5 rounded-full transition-colors ${
                reschedule ? "bg-indigo-500" : "bg-[#2a2a3c]"
              }`}
              onClick={() => setReschedule(!reschedule)}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  reschedule ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
              Reschedule remaining {remainingMinutes} minutes
            </span>
          </label>
        )}

        {/* Metric logging — only shown if task has a linked metric */}
        {event.taskMetric && (
          <div className="rounded-lg bg-[#12121c] border border-[#2a2a3c] p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {event.taskMetric.icon} Log {event.taskMetric.name}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="0"
                value={metricValue}
                onChange={(e) => setMetricValue(e.target.value)}
                min={0}
                step="any"
                className="w-28 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50"
              />
              <span className="text-sm text-gray-500">{event.taskMetric.unit}</span>
            </div>
            <input
              type="text"
              placeholder="Notes (optional)"
              value={metricNotes}
              onChange={(e) => setMetricNotes(e.target.value)}
              className="w-full rounded-lg bg-[#1e1e30] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 placeholder:text-gray-600"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Confirm Completion
          </button>
        </div>
      </div>
    </div>
  );
}
