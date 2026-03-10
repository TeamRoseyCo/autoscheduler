"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ParsedEvent } from "@/app/api/smart-import/parse/route";

// ── Event type config ──

const EVENT_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  meeting: { label: "Meeting", icon: "M", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40" },
  travel: { label: "Travel", icon: "T", color: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
  appointment: { label: "Appointment", icon: "A", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
  social: { label: "Social", icon: "S", color: "bg-pink-500/20 text-pink-400 border-pink-500/40" },
  deadline: { label: "Deadline", icon: "!", color: "bg-red-500/20 text-red-400 border-red-500/40" },
  reminder: { label: "Reminder", icon: "R", color: "bg-slate-500/20 text-slate-400 border-slate-500/40" },
  class: { label: "Class", icon: "C", color: "bg-sky-500/20 text-sky-400 border-sky-500/40" },
  other: { label: "Other", icon: "?", color: "bg-gray-500/20 text-gray-400 border-gray-500/40" },
};

type InputMode = "text" | "file";

interface SmartImportFABProps {
  onImported: () => void;
}

export function SmartImportFAB({ onImported }: SmartImportFABProps) {
  const [active, setActive] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Persist active state
  useEffect(() => {
    const saved = localStorage.getItem("smart-import-active");
    if (saved === "true") setActive(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("smart-import-active", String(active));
  }, [active]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleParse = useCallback(async (content: string, source: "text" | "ics" | "email") => {
    setParsing(true);
    setError(null);
    setParsedEvents([]);
    setSelectedIds(new Set());

    try {
      const res = await fetch("/api/smart-import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");

      const events: ParsedEvent[] = data.events || [];
      setParsedEvents(events);
      // Auto-select high confidence events
      setSelectedIds(new Set(events.filter((e) => e.confidence >= 0.7).map((e) => e.id)));

      if (events.length === 0) {
        setError("No events detected. Try pasting more detail.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse");
    } finally {
      setParsing(false);
    }
  }, []);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    // Detect if it looks like an ICS file
    const isICS = textInput.includes("BEGIN:VCALENDAR") || textInput.includes("BEGIN:VEVENT");
    // Detect if it looks like an email (has From: / Subject: headers)
    const isEmail = /^(from|subject|date):/im.test(textInput);
    handleParse(textInput, isICS ? "ics" : isEmail ? "email" : "text");
  }, [textInput, handleParse]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const isICS = file.name.endsWith(".ics") || content.includes("BEGIN:VCALENDAR");
      handleParse(content, isICS ? "ics" : "email");
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }, [handleParse]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === parsedEvents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(parsedEvents.map((e) => e.id)));
    }
  }, [selectedIds, parsedEvents]);

  const handleApproveSelected = useCallback(async () => {
    const toCreate = parsedEvents.filter((e) => selectedIds.has(e.id));
    if (toCreate.length === 0) return;

    setCreating(true);
    try {
      const res = await fetch("/api/smart-import/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: toCreate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");

      setToast(`Added ${data.count} event${data.count !== 1 ? "s" : ""} to calendar`);
      setParsedEvents([]);
      setSelectedIds(new Set());
      setTextInput("");
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create events");
    } finally {
      setCreating(false);
    }
  }, [parsedEvents, selectedIds, onImported]);

  const updateEvent = useCallback((id: string, field: keyof ParsedEvent, value: string) => {
    setParsedEvents((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        if (field === "eventType") {
          const color = EVENT_TYPE_META[value]?.color
            ? { meeting: "indigo", travel: "amber", appointment: "emerald", social: "pink", deadline: "red", reminder: "slate", class: "sky", other: "gray" }[value] || "gray"
            : "gray";
          return { ...e, eventType: value as ParsedEvent["eventType"], color };
        }
        return { ...e, [field]: value };
      })
    );
  }, []);

  // ── FAB button (always visible when active) ──

  // Positioned above Cam's FAB (which is fixed bottom-4 right-4, 56px tall)
  // So we go bottom-4 + 56px + 12px gap = bottom-[72px]

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="fixed bottom-[76px] right-[10px] z-40 w-12 h-12 rounded-full bg-[#1e1e30] border border-[#2a2a3c] text-gray-500 hover:text-indigo-400 hover:border-indigo-500/50 shadow-lg transition-all flex items-center justify-center group"
        title="Enable Smart Import"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {/* FAB — sits directly above Cam's chat button */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className={`fixed bottom-[76px] right-4 z-40 w-14 h-14 rounded-full shadow-lg transition-all flex items-center justify-center ${
          panelOpen
            ? "bg-indigo-600 text-white rotate-45"
            : "bg-indigo-600 text-white hover:bg-indigo-500"
        }`}
        title="Smart Import"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {panelOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          )}
        </svg>
      </button>

      {/* Panel */}
      {panelOpen && (
        <div className="fixed bottom-[140px] right-4 z-40 w-[420px] max-h-[calc(100vh-160px)] bg-[#16161f] border border-[#2a2a3c] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#2a2a3c] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 text-sm font-semibold">Smart Import</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-medium">EXPERIMENTAL</span>
            </div>
            <button
              onClick={() => { setActive(false); setPanelOpen(false); }}
              className="text-gray-500 hover:text-red-400 text-xs transition-colors"
              title="Disable Smart Import"
            >
              Disable
            </button>
          </div>

          {/* Input Mode Tabs */}
          <div className="px-4 pt-3 flex gap-2">
            <button
              onClick={() => setInputMode("text")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                inputMode === "text"
                  ? "bg-indigo-600 text-white"
                  : "bg-[#1e1e30] text-gray-400 hover:text-white"
              }`}
            >
              Paste Text / Email
            </button>
            <button
              onClick={() => setInputMode("file")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                inputMode === "file"
                  ? "bg-indigo-600 text-white"
                  : "bg-[#1e1e30] text-gray-400 hover:text-white"
              }`}
            >
              Upload File
            </button>
          </div>

          {/* Input Area */}
          <div className="px-4 py-3">
            {inputMode === "text" ? (
              <div className="space-y-2">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={`Paste anything:\n- Email with event details\n- Train/flight confirmation\n- "Meeting with John tomorrow at 3pm"\n- ICS file content\n- Party invite...`}
                  className="w-full h-28 bg-[#12121c] border border-[#2a2a3c] rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500/50"
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={parsing || !textInput.trim()}
                  className="w-full py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {parsing ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      Analyzing...
                    </>
                  ) : (
                    "Detect Events"
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ics,.ical,.txt,.eml,.msg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={parsing}
                  className="w-full py-6 rounded-xl border-2 border-dashed border-[#2a2a3c] hover:border-indigo-500/50 text-gray-500 hover:text-indigo-400 transition-colors flex flex-col items-center gap-2"
                >
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-sm font-medium">
                    {parsing ? "Analyzing..." : "Drop .ics, .eml, or .txt file"}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Parsed Events (Approval Queue) */}
          {parsedEvents.length > 0 && (
            <div className="flex-1 overflow-y-auto border-t border-[#2a2a3c]">
              <div className="px-4 py-2 flex items-center justify-between sticky top-0 bg-[#16161f] z-10">
                <span className="text-xs text-gray-400">
                  {parsedEvents.length} event{parsedEvents.length !== 1 ? "s" : ""} detected
                </span>
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {selectedIds.size === parsedEvents.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div className="px-4 pb-3 space-y-2">
                {parsedEvents.map((ev) => {
                  const meta = EVENT_TYPE_META[ev.eventType] || EVENT_TYPE_META.other;
                  const isSelected = selectedIds.has(ev.id);

                  return (
                    <div
                      key={ev.id}
                      className={`rounded-xl border transition-all ${
                        isSelected
                          ? "border-indigo-500/50 bg-indigo-500/5"
                          : "border-[#2a2a3c] bg-[#1e1e30]/50"
                      }`}
                    >
                      {/* Top row: checkbox + title + type badge */}
                      <div className="px-3 py-2 flex items-start gap-2">
                        <button
                          onClick={() => toggleSelect(ev.id)}
                          className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-[#2a2a3c] text-transparent hover:border-gray-500"
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <input
                            value={ev.title}
                            onChange={(e) => updateEvent(ev.id, "title", e.target.value)}
                            className="w-full bg-transparent text-sm text-gray-200 font-medium focus:outline-none"
                          />
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span>{ev.date}</span>
                            <span>
                              <input
                                value={ev.startTime}
                                onChange={(e) => updateEvent(ev.id, "startTime", e.target.value)}
                                className="w-12 bg-transparent text-gray-400 focus:outline-none focus:text-indigo-400"
                              />
                              {" - "}
                              <input
                                value={ev.endTime}
                                onChange={(e) => updateEvent(ev.id, "endTime", e.target.value)}
                                className="w-12 bg-transparent text-gray-400 focus:outline-none focus:text-indigo-400"
                              />
                            </span>
                            {ev.location && (
                              <span className="truncate max-w-[120px]" title={ev.location}>
                                @ {ev.location}
                              </span>
                            )}
                          </div>
                        </div>

                        <select
                          value={ev.eventType}
                          onChange={(e) => updateEvent(ev.id, "eventType", e.target.value)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium appearance-none cursor-pointer ${meta.color} bg-transparent focus:outline-none`}
                        >
                          {Object.entries(EVENT_TYPE_META).map(([key, m]) => (
                            <option key={key} value={key} className="bg-[#1e1e30] text-gray-200">
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Confidence bar */}
                      <div className="px-3 pb-2">
                        <div className="h-1 bg-[#2a2a3c] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              ev.confidence >= 0.8
                                ? "bg-emerald-500"
                                : ev.confidence >= 0.5
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${ev.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                    <>
                      Add {selectedIds.size} event{selectedIds.size !== 1 ? "s" : ""} to calendar
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-[140px] right-[440px] z-50 bg-emerald-600 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
