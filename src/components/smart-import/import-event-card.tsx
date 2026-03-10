"use client";

import { useState, useRef, useEffect } from "react";

const EVENT_TYPE_META: Record<string, { label: string; color: string }> = {
  meeting: { label: "Meeting", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40" },
  travel: { label: "Travel", color: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
  appointment: { label: "Appointment", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
  social: { label: "Social", color: "bg-pink-500/20 text-pink-400 border-pink-500/40" },
  deadline: { label: "Deadline", color: "bg-red-500/20 text-red-400 border-red-500/40" },
  reminder: { label: "Reminder", color: "bg-slate-500/20 text-slate-400 border-slate-500/40" },
  class: { label: "Class", color: "bg-sky-500/20 text-sky-400 border-sky-500/40" },
  other: { label: "Other", color: "bg-gray-500/20 text-gray-400 border-gray-500/40" },
};

export interface ImportEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  description?: string | null;
  eventType: string;
  color: string;
  confidence: number;
  source: string;
  suggestedByAI: boolean;
  config?: { name: string } | null;
}

interface ImportEventCardProps {
  event: ImportEvent;
  selected: boolean;
  onToggleSelect: () => void;
  onUpdate: (field: string, value: string) => void;
  onDelete: () => void;
  onRequestTimeSuggestions: () => void;
}

export function ImportEventCard({
  event,
  selected,
  onToggleSelect,
  onUpdate,
  onDelete,
  onRequestTimeSuggestions,
}: ImportEventCardProps) {
  const meta = EVENT_TYPE_META[event.eventType] || EVENT_TYPE_META.other;

  return (
    <div
      className={`rounded-xl border transition-all ${
        selected
          ? "border-indigo-500/50 bg-indigo-500/5"
          : "border-[#2a2a3c] bg-[#1e1e30]/50"
      }`}
    >
      {/* Top row: checkbox + title + type badge */}
      <div className="px-3 py-2 flex items-start gap-2">
        <button
          onClick={onToggleSelect}
          className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
            selected
              ? "bg-indigo-600 border-indigo-600 text-white"
              : "border-[#2a2a3c] text-transparent hover:border-gray-500"
          }`}
        >
          {selected && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <input
              value={event.title}
              onChange={(e) => onUpdate("title", e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-200 font-medium focus:outline-none"
            />
            {event.suggestedByAI && (
              <button
                onClick={onRequestTimeSuggestions}
                className="text-amber-400 hover:text-amber-300 flex-shrink-0"
                title="AI-suggested time - click for alternatives"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <input
              value={event.date}
              onChange={(e) => onUpdate("date", e.target.value)}
              className="w-[82px] bg-transparent text-gray-400 focus:outline-none focus:text-indigo-400"
              placeholder="YYYY-MM-DD"
            />
            <span>
              <input
                value={event.startTime}
                onChange={(e) => onUpdate("startTime", e.target.value)}
                className="w-12 bg-transparent text-gray-400 focus:outline-none focus:text-indigo-400"
              />
              {" - "}
              <input
                value={event.endTime}
                onChange={(e) => onUpdate("endTime", e.target.value)}
                className="w-12 bg-transparent text-gray-400 focus:outline-none focus:text-indigo-400"
              />
            </span>
            {event.location && (
              <span className="truncate max-w-[100px]" title={event.location}>
                @ {event.location}
              </span>
            )}
          </div>
          {event.config && (
            <div className="mt-1 text-[10px] text-gray-600">
              via {event.config.name}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <select
            value={event.eventType}
            onChange={(e) => onUpdate("eventType", e.target.value)}
            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium appearance-none cursor-pointer ${meta.color} bg-transparent focus:outline-none`}
          >
            {Object.entries(EVENT_TYPE_META).map(([key, m]) => (
              <option key={key} value={key} className="bg-[#1e1e30] text-gray-200">
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={onDelete}
            className="text-gray-600 hover:text-red-400 transition-colors"
            title="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="px-3 pb-2">
        <div className="h-1 bg-[#2a2a3c] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              event.confidence >= 0.8
                ? "bg-emerald-500"
                : event.confidence >= 0.5
                ? "bg-amber-500"
                : "bg-red-500"
            }`}
            style={{ width: `${event.confidence * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
