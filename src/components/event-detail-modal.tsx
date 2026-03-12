"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CalendarEventData } from "@/components/week-calendar";
import { categorizeTask } from "@/lib/categorize";
import { EmojiPicker } from "@/components/emoji-picker";
import { DescriptionWand } from "@/components/description-wand";
import { TransportBufferModal } from "@/components/transport-buffer-modal";

interface EventDetailModalProps {
  event: CalendarEventData | null;
  onClose: () => void;
  onSaved: () => void;
  onStartTask?: (event: CalendarEventData) => void;
  onStopTask?: (event: CalendarEventData) => void;
}

const COLOR_OPTIONS = [
  { value: "indigo", label: "Focus", bg: "bg-indigo-500", ring: "ring-indigo-400" },
  { value: "emerald", label: "Light", bg: "bg-emerald-500", ring: "ring-emerald-400" },
  { value: "amber", label: "Admin", bg: "bg-amber-500", ring: "ring-amber-400" },
  { value: "gray", label: "Other", bg: "bg-slate-500", ring: "ring-slate-400" },
];

const ENERGY_TO_COLOR: Record<string, string> = {
  deep: "indigo",
  light: "emerald",
  admin: "amber",
};

function formatTimeLabel(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === "00" ? `${hour} ${ampm}` : `${hour}:${m} ${ampm}`;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isoToHHMM(isoStr: string): string {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function EventDetailModal({ event, onClose, onSaved, onStartTask, onStopTask }: EventDetailModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [color, setColor] = useState("indigo");
  const [availability, setAvailability] = useState("busy");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [transportBefore, setTransportBefore] = useState(0);
  const [transportAfter, setTransportAfter] = useState(0);
  const [transportMode, setTransportMode] = useState("driving");
  const [transportModalOpen, setTransportModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);

  const isGoogle = event?.source === "google";
  const isLocked = event?.locked || false;
  const isReadOnly = isGoogle || isLocked;

  // Populate form when event changes
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDate(event.date);
      setStartTime(isoToHHMM(event.startTime));
      setEndTime(isoToHHMM(event.endTime));
      setColor(event.color);
      setAvailability(event.availability || "busy");
      setDescription("");
      setLocation(event.location || "");
      setTransportBefore(event.transportBefore ?? 0);
      setTransportAfter(event.transportAfter ?? 0);
      setTransportMode(event.transportMode || "driving");
      setError("");
      setSubmitting(false);
      setDeleting(false);
    }
  }, [event]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!event) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, onClose, isReadOnly, title, date, startTime, endTime, color, availability, location, transportBefore, transportAfter, transportMode]);

  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleTitleBlur = () => {
    if (!title.trim() || isReadOnly) return;
    const result = categorizeTask(title);
    setColor(ENERGY_TO_COLOR[result.energyType] || "gray");
    const firstChar = title.codePointAt(0) || 0;
    const isEmoji = firstChar > 0x1F000;
    if (!isEmoji) {
      setTitle(`${result.emoji} ${title}`);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const stripped = title.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\uFE0F?\s*/u, "");
    setTitle(`${emoji} ${stripped}`);
    titleInputRef.current?.focus();
  };

  const isLocal = event ? event.source === "local" && !event.googleEventId : false;
  const isInProgress = event?.status === "in_progress";
  const isCompleted = event?.status === "completed";

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose]
  );

  const handleSave = async () => {
    if (!event) return;

    setSubmitting(true);
    setError("");

    try {
      if (isGoogle) {
        // For Google events, only save transport/location data locally
        const res = await fetch("/api/calendar/google-event-transport", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            googleEventId: event.googleEventId,
            location: location.trim() || null,
            transportBefore: transportBefore || null,
            transportAfter: transportAfter || null,
            transportMode: transportBefore || transportAfter ? transportMode : null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to save");
        }
      } else {
        // Local event — save everything
        if (!title.trim()) {
          setError("Title is required");
          setSubmitting(false);
          return;
        }
        if (startTime >= endTime) {
          setError("End time must be after start time");
          setSubmitting(false);
          return;
        }
        const startISO = new Date(`${date}T${startTime}:00`).toISOString();
        const endISO = new Date(`${date}T${endTime}:00`).toISOString();

        const res = await fetch(`/api/calendar/blocks/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            date,
            startTime: startISO,
            endTime: endISO,
            color,
            availability,
            location: location.trim() || null,
            transportBefore: transportBefore || null,
            transportAfter: transportAfter || null,
            transportMode: transportBefore || transportAfter ? transportMode : null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to save");
        }
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event || isReadOnly) return;

    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/calendar/blocks/${event.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  };

  const handleUncheck = async () => {
    if (!event) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar/blocks/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "scheduled",
          actualStartTime: null,
          actualEndTime: null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to uncheck");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLock = async () => {
    if (!event || isGoogle) return;
    setToggling(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar/blocks/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !event.locked }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to toggle lock");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setToggling(false);
    }
  };

  if (!event) return null;

  return (
    <>
    {transportModalOpen && (
      <TransportBufferModal
        event={event}
        initialLocation={location}
        initialTransportBefore={transportBefore}
        initialTransportAfter={transportAfter}
        initialTransportMode={transportMode}
        onClose={() => setTransportModalOpen(false)}
        onSave={(data) => {
          setLocation(data.location);
          setTransportBefore(data.transportBefore);
          setTransportAfter(data.transportAfter);
          setTransportMode(data.transportMode);
          setTransportModalOpen(false);
        }}
      />
    )}
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div
        className="relative w-full max-w-lg bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top section */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300 border border-blue-500/20">
              Event
            </span>
            {isLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-500/20">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Locked
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-[#2a2a3c]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <div className="px-6 pb-4">
          {isReadOnly ? (
            <h2 className="text-xl font-semibold text-gray-100">{title}</h2>
          ) : (
            <div className="flex items-center gap-1">
              <EmojiPicker onSelect={handleEmojiSelect} />
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                placeholder="Event title"
                className="flex-1 bg-transparent text-xl font-semibold text-gray-100 placeholder-gray-600 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Date/time pills */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {isReadOnly ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-1.5 text-sm text-gray-300">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-500">
                    <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />
                    <path d="M1.5 5.5h11M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                  {formatDateLabel(date)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-1.5 text-sm text-gray-300">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-500">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1" />
                    <path d="M7 4v3l2 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {formatTimeLabel(startTime)} — {formatTimeLabel(endTime)}
                </span>
              </>
            ) : (
              <>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                />
                <span className="text-gray-500 text-sm">—</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                />
              </>
            )}
          </div>
        </div>

        {/* Task Deadline */}
        {event.taskId && event.taskDeadline && (
          <div className="px-6 pb-2 pt-1">
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-red-400 flex-shrink-0">
                <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="8" cy="9.5" r="1" fill="currentColor" />
              </svg>
              <span className="text-xs text-red-300 font-medium">Deadline:</span>
              <span className="text-xs text-red-200">
                {formatDateLabel(new Date(event.taskDeadline).toISOString().split("T")[0])}
                {event.taskDeadlineTime && ` at ${formatTimeLabel(event.taskDeadlineTime)}`}
              </span>
            </div>
          </div>
        )}

        <div className="h-px bg-[#2a2a3c] mx-6" />

        {/* Event details section */}
        <div className="px-6 py-4 space-y-4">
          {/* Location */}
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
              <path d="M8 14s-5-4.5-5-8a5 5 0 1110 0c0 3.5-5 8-5 8z" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
              className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none disabled:text-gray-500"
            />
          </div>

          {/* Transport buffer section */}
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
              <path d="M2 11h12M3 11V8l3-4h5l2 4v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="5" cy="12.5" r="1" fill="currentColor" />
              <circle cx="11" cy="12.5" r="1" fill="currentColor" />
            </svg>
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <span className="text-xs text-gray-500">Travel:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={transportBefore || ""}
                  onChange={(e) => setTransportBefore(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-14 bg-[#12121c] border border-[#2a2a3c] rounded px-2 py-0.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                />
                <span className="text-xs text-gray-500">min before</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={transportAfter || ""}
                  onChange={(e) => setTransportAfter(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-14 bg-[#12121c] border border-[#2a2a3c] rounded px-2 py-0.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                />
                <span className="text-xs text-gray-500">min after</span>
              </div>
              <button
                type="button"
                onClick={() => setTransportModalOpen(true)}
                title="Configure transport"
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors border border-indigo-500/20"
              >
                🗺️ Configure
              </button>
            </div>
          </div>

          {/* Transport buffer preview (read-only or when set) */}
          {(transportBefore > 0 || transportAfter > 0) && (
            <div className="flex items-center gap-3">
              <div className="w-4 flex-shrink-0" />
              <p className="text-xs text-indigo-300/70">
                {transportBefore > 0 && (
                  <span>
                    {{"driving":"🚗","transit":"🚌","walking":"🚶","cycling":"🚴"}[transportMode] || "🚗"}{" "}
                    {transportBefore}m before
                  </span>
                )}
                {transportBefore > 0 && transportAfter > 0 && " · "}
                {transportAfter > 0 && (
                  <span>{transportAfter}m after</span>
                )}
              </p>
            </div>
          )}

          {/* Color selector */}
          {!isReadOnly && (
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="8" cy="8" r="2.5" fill="currentColor" />
              </svg>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setColor(opt.value)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all ${
                      color === opt.value
                        ? `${opt.bg} text-white ring-2 ${opt.ring} ring-offset-1 ring-offset-[#1e1e30]`
                        : "bg-[#2a2a3c] text-gray-400 hover:text-gray-200 hover:bg-[#3a3a4c]"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${opt.bg}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Availability */}
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5 8h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              {availability !== "busy" && (
                <path d="M8 5v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              )}
            </svg>
            {isReadOnly ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                availability === "busy" ? "bg-red-500/20 text-red-300 border border-red-500/20" :
                availability === "free_tight" ? "bg-amber-500/20 text-amber-300 border border-amber-500/20" :
                availability === "free_light" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/20" :
                "bg-emerald-500/20 text-emerald-300 border border-emerald-500/20"
              }`}>
                {availability === "busy" ? "Busy" :
                 availability === "free_tight" ? "Free (tight)" :
                 availability === "free_light" ? "Free (light)" : "Free"}
              </span>
            ) : (
              <div className="flex gap-2">
                {[
                  { value: "busy", label: "Busy", active: "bg-red-500/20 text-red-300 ring-1 ring-red-500/40" },
                  { value: "free_tight", label: "Tight", active: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40" },
                  { value: "free_light", label: "Light", active: "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40" },
                  { value: "free", label: "Free", active: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAvailability(opt.value)}
                    className={`rounded-full px-3 py-1 text-xs transition-all ${
                      availability === opt.value
                        ? opt.active
                        : "bg-[#2a2a3c] text-gray-400 hover:text-gray-200 hover:bg-[#3a3a4c]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Source badge */}
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
              <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M6 6h4M6 8h4M6 10h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isGoogle
                ? "bg-slate-500/20 text-slate-300 border border-slate-500/20"
                : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
            }`}>
              {isGoogle ? "Google Calendar" : "Local"}
            </span>
          </div>

          {/* Status indicator for local events */}
          {isLocal && event && (
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {isInProgress && event.actualStartTime && (
                <span className="text-sm text-red-400 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Timer running since {new Date(event.actualStartTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
              {isCompleted && event.actualStartTime && event.actualEndTime && (
                <span className="text-sm text-emerald-400">
                  Completed: {new Date(event.actualStartTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} — {new Date(event.actualEndTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
              {!isInProgress && !isCompleted && (
                <span className="text-sm text-gray-500">Scheduled</span>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            {!isReadOnly && (
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#2a2a3c]">
                <span className="text-xs text-gray-500 font-medium">Description</span>
                <DescriptionWand title={title} onGenerated={setDescription} />
              </div>
            )}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isReadOnly ? "No description" : "Add a description..."}
              disabled={isReadOnly}
              rows={3}
              className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500/50 disabled:bg-transparent disabled:border-transparent disabled:text-gray-500"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">{error}</div>
        )}

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2a2a3c]">
          <div className="flex items-center gap-3">
            {/* Lock/Unlock toggle — available for all local events */}
            {event && event.source === "local" && (
              <button
                type="button"
                onClick={handleToggleLock}
                disabled={toggling}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
                  isLocked
                    ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                    : "text-gray-400 hover:text-gray-300 hover:bg-[#2a2a3c]"
                }`}
              >
                {isLocked ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M11 7V5a3 3 0 00-5.02-2.22" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    {toggling ? "Unlocking..." : "Unlock"}
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    {toggling ? "Locking..." : "Lock"}
                  </>
                )}
              </button>
            )}
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 4h9M5 4V2.5h4V4M3.5 4v7.5a1 1 0 001 1h5a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
            {isLocal && isCompleted && (
              <button
                type="button"
                onClick={handleUncheck}
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M4.5 7h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Uncheck
              </button>
            )}
            {isLocal && !isCompleted && event && (
              <>
                {isInProgress ? (
                  <button
                    type="button"
                    onClick={() => { if (onStopTask && event) { onStopTask(event); onClose(); } }}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" />
                    </svg>
                    Stop Task
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { if (onStartTask && event) { onStartTask(event); onClose(); } }}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <polygon points="4,2 12,7 4,12" fill="currentColor" />
                    </svg>
                    Start Task
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors"
            >
              Cancel
              <kbd className="text-[10px] text-gray-600 bg-[#12121c] border border-[#2a2a3c] rounded px-1.5 py-0.5">Esc</kbd>
            </button>
            {!isLocked && (
              <button
                type="button"
                onClick={handleSave}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving...
                  </>
                ) : (
                  <>
                    {isGoogle ? "Save transport" : "Save"}
                    <kbd className="text-[10px] text-indigo-300/60 bg-indigo-700/50 border border-indigo-500/30 rounded px-1.5 py-0.5">Ctrl+S</kbd>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
