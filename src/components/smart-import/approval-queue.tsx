"use client";

import { useState, useCallback } from "react";
import { ImportEventCard, type ImportEvent } from "./import-event-card";
import { TimeSuggestionPopover } from "./time-suggestion-popover";

const EVENT_TYPE_COLORS: Record<string, string> = {
  meeting: "indigo",
  travel: "amber",
  appointment: "emerald",
  social: "pink",
  deadline: "red",
  reminder: "slate",
  class: "sky",
  other: "gray",
};

interface ApprovalQueueProps {
  events: ImportEvent[];
  onEventsChange: (events: ImportEvent[]) => void;
  onApproved: () => void;
}

export function ApprovalQueue({ events, onEventsChange, onApproved }: ApprovalQueueProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(events.filter((e) => e.confidence >= 0.7).map((e) => e.id))
  );
  const [creating, setCreating] = useState(false);
  const [timeSuggestionFor, setTimeSuggestionFor] = useState<string | null>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === events.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(events.map((e) => e.id)));
    }
  }, [selectedIds.size, events]);

  const handleUpdate = useCallback(
    async (id: string, field: string, value: string) => {
      // Optimistic local update
      const updated = events.map((e) => {
        if (e.id !== id) return e;
        if (field === "eventType") {
          return { ...e, eventType: value, color: EVENT_TYPE_COLORS[value] || "gray" };
        }
        return { ...e, [field]: value };
      });
      onEventsChange(updated);

      // Persist to server
      try {
        await fetch("/api/smart-import/events", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, [field]: value, ...(field === "eventType" ? { color: EVENT_TYPE_COLORS[value] || "gray" } : {}) }),
        });
      } catch {
        // silently fail - user can retry
      }
    },
    [events, onEventsChange]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      onEventsChange(events.filter((e) => e.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      try {
        await fetch(`/api/smart-import/events?id=${id}`, { method: "DELETE" });
      } catch {
        // silently fail
      }
    },
    [events, onEventsChange]
  );

  const handleTimeSuggestionSelect = useCallback(
    (eventId: string, date: string, startTime: string, endTime: string) => {
      handleUpdate(eventId, "date", date);
      // Small delay to avoid race
      setTimeout(() => {
        handleUpdate(eventId, "startTime", startTime);
        handleUpdate(eventId, "endTime", endTime);
      }, 50);
      setTimeSuggestionFor(null);
    },
    [handleUpdate]
  );

  const handleApproveSelected = useCallback(async () => {
    const toCreate = Array.from(selectedIds);
    if (toCreate.length === 0) return;

    setCreating(true);
    try {
      const res = await fetch("/api/smart-import/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: toCreate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");

      // Remove approved events from list
      onEventsChange(events.filter((e) => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
      onApproved();
    } catch (err) {
      console.error("Failed to approve events:", err);
    } finally {
      setCreating(false);
    }
  }, [events, selectedIds, onEventsChange, onApproved]);

  if (events.length === 0) return null;

  return (
    <div className="flex-1 overflow-y-auto border-t border-[#2a2a3c]">
      <div className="px-4 py-2 flex items-center justify-between sticky top-0 bg-[#16161f] z-10">
        <span className="text-xs text-gray-400">
          {events.length} pending event{events.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={toggleSelectAll}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {selectedIds.size === events.length ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="px-4 pb-3 space-y-2">
        {events.map((ev) => (
          <div key={ev.id} className="relative">
            <ImportEventCard
              event={ev}
              selected={selectedIds.has(ev.id)}
              onToggleSelect={() => toggleSelect(ev.id)}
              onUpdate={(field, value) => handleUpdate(ev.id, field, value)}
              onDelete={() => handleDelete(ev.id)}
              onRequestTimeSuggestions={() =>
                setTimeSuggestionFor(timeSuggestionFor === ev.id ? null : ev.id)
              }
            />
            {timeSuggestionFor === ev.id && (
              <TimeSuggestionPopover
                eventId={ev.id}
                eventType={ev.eventType}
                date={ev.date}
                onSelect={(date, start, end) =>
                  handleTimeSuggestionSelect(ev.id, date, start, end)
                }
                onClose={() => setTimeSuggestionFor(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Approve button */}
      <div className="px-4 py-3 border-t border-[#2a2a3c] bg-[#16161f] sticky bottom-0">
        <button
          onClick={handleApproveSelected}
          disabled={selectedIds.size === 0 || creating}
          className="w-full py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {creating ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              Adding...
            </>
          ) : (
            `Add ${selectedIds.size} event${selectedIds.size !== 1 ? "s" : ""} to calendar`
          )}
        </button>
      </div>
    </div>
  );
}
