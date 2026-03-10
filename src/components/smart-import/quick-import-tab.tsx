"use client";

import { useState, useRef, useCallback } from "react";
import type { ImportEvent } from "./import-event-card";

type InputMode = "text" | "file" | "nl";

interface QuickImportTabProps {
  onEventsParsed: (events: ImportEvent[]) => void;
}

export function QuickImportTab({ onEventsParsed }: QuickImportTabProps) {
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [textInput, setTextInput] = useState("");
  const [nlInput, setNlInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleParse = useCallback(
    async (content: string, source: "text" | "ics" | "email" | "natural_language") => {
      setParsing(true);
      setError(null);

      try {
        const res = await fetch("/api/smart-import/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, source }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Parse failed");

        const events: ImportEvent[] = (data.events || []).map((e: ImportEvent) => ({
          ...e,
          config: null,
        }));

        if (events.length === 0) {
          setError("No events detected. Try adding more detail.");
        } else {
          onEventsParsed(events);
          setTextInput("");
          setNlInput("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse");
      } finally {
        setParsing(false);
      }
    },
    [onEventsParsed]
  );

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    const isICS = textInput.includes("BEGIN:VCALENDAR") || textInput.includes("BEGIN:VEVENT");
    const isEmail = /^(from|subject|date):/im.test(textInput);
    handleParse(textInput, isICS ? "ics" : isEmail ? "email" : "text");
  }, [textInput, handleParse]);

  const handleNlSubmit = useCallback(() => {
    if (!nlInput.trim()) return;
    handleParse(nlInput, "natural_language");
  }, [nlInput, handleParse]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const isICS = file.name.endsWith(".ics") || content.includes("BEGIN:VCALENDAR");
        handleParse(content, isICS ? "ics" : "email");
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [handleParse]
  );

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Sub-mode tabs */}
      <div className="flex gap-1.5">
        {(
          [
            { key: "text" as const, label: "Paste" },
            { key: "file" as const, label: "Upload" },
            { key: "nl" as const, label: "Tell AI" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setInputMode(tab.key)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              inputMode === tab.key
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Text paste mode */}
      {inputMode === "text" && (
        <div className="space-y-2">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={`Paste anything:\n- Email with event details\n- Train/flight confirmation\n- ICS file content\n- Party invite...`}
            className="w-full h-24 bg-[#12121c] border border-[#2a2a3c] rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500/50"
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
      )}

      {/* File upload mode */}
      {inputMode === "file" && (
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
            className="w-full py-5 rounded-xl border-2 border-dashed border-[#2a2a3c] hover:border-indigo-500/50 text-gray-500 hover:text-indigo-400 transition-colors flex flex-col items-center gap-2"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="text-xs font-medium">
              {parsing ? "Analyzing..." : "Drop .ics, .eml, or .txt file"}
            </span>
          </button>
        </div>
      )}

      {/* Natural language mode */}
      {inputMode === "nl" && (
        <div className="space-y-2">
          <div className="relative">
            <textarea
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              placeholder={`Tell the AI what to schedule:\n- "Dentist next Thursday morning"\n- "Weekly team sync Mon-Fri at 9am"\n- "Lunch with Sarah on the 15th"`}
              className="w-full h-24 bg-[#12121c] border border-[#2a2a3c] rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500/50"
            />
            <div className="absolute top-2 right-2">
              <svg className="w-4 h-4 text-amber-400/60" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
          </div>
          <button
            onClick={handleNlSubmit}
            disabled={parsing || !nlInput.trim()}
            className="w-full py-2 rounded-xl text-sm font-medium bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {parsing ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                Finding time slots...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Smart Schedule
              </>
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
