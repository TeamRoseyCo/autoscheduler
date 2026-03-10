"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TYPE_OPTIONS = ["lecture", "lab", "tutorial", "seminar"];

interface DetectedClass {
  summary: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string;
  recurrenceCount: number;
}

interface ClassWithMeta extends DetectedClass {
  selected: boolean;
  type: string;
}

export function GCalDetectModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [classes, setClasses] = useState<ClassWithMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  if (!isOpen) return null;

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/uni/gcal-detect");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to scan calendar");
      }
      const data = await res.json();
      setClasses(
        data.classes.map((c: DetectedClass) => ({
          ...c,
          selected: true,
          type: "lecture",
        }))
      );
      setScanned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan");
    } finally {
      setScanning(false);
    }
  };

  const handleImport = async () => {
    const selected = classes.filter((c) => c.selected);
    if (selected.length === 0) return;

    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/uni/gcal-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classes: selected.map((c) => ({
            summary: c.summary,
            dayOfWeek: c.dayOfWeek,
            startTime: c.startTime,
            endTime: c.endTime,
            location: c.location,
            type: c.type,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to import");
      }

      const data = await res.json();
      setResult(data.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setImporting(false);
    }
  };

  const toggleClass = (idx: number) => {
    setClasses((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c))
    );
  };

  const toggleAll = () => {
    const allSelected = classes.every((c) => c.selected);
    setClasses((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
  };

  const setType = (idx: number, type: string) => {
    setClasses((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, type } : c))
    );
  };

  const selectedCount = classes.filter((c) => c.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3c]">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Detect Schedule from Google Calendar</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Scans your calendar for recurring events that look like classes
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
              {result}
            </div>
          )}

          {!scanned ? (
            <div className="text-center py-12">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mx-auto text-gray-600 mb-4">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="16" r="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <p className="text-gray-400 text-sm mb-4">
                This will scan 4 weeks of your Google Calendar to find recurring events
                that repeat at the same day and time each week.
              </p>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {scanning ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                    </svg>
                    Scanning calendar...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Scan Google Calendar
                  </>
                )}
              </button>
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">
                No recurring events found. Events need to appear at least 2 times
                at the same day/time over 4 weeks to be detected as classes.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-400">
                  Found {classes.length} recurring event{classes.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={toggleAll}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {classes.every((c) => c.selected) ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div className="space-y-2">
                {classes.map((cls, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border px-4 py-3 transition-colors ${
                      cls.selected
                        ? "bg-[#12121c] border-blue-500/30"
                        : "bg-[#12121c] border-[#2a2a3c] opacity-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleClass(idx)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          cls.selected
                            ? "border-blue-500 bg-blue-600 text-white"
                            : "border-[#2a2a3c] text-transparent hover:border-gray-500"
                        }`}
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{cls.summary}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-gray-500">
                            {DAY_NAMES[cls.dayOfWeek]}
                          </span>
                          <span className="text-xs text-gray-600">|</span>
                          <span className="text-xs text-gray-500">
                            {cls.startTime} - {cls.endTime}
                          </span>
                          {cls.location && (
                            <>
                              <span className="text-xs text-gray-600">|</span>
                              <span className="text-xs text-gray-500 truncate">{cls.location}</span>
                            </>
                          )}
                          <span className="text-xs text-gray-600">|</span>
                          <span className="text-xs text-blue-400">{cls.recurrenceCount}x found</span>
                        </div>
                      </div>

                      <select
                        value={cls.type}
                        onChange={(e) => setType(idx, e.target.value)}
                        className="text-xs bg-[#1e1e30] border border-[#2a2a3c] rounded px-2 py-1 text-gray-400 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                      >
                        {TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {scanned && classes.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-3 border-t border-[#2a2a3c]">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="rounded-md px-3 py-1.5 text-xs font-medium border border-[#2a2a3c] text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] disabled:opacity-50 transition-colors"
            >
              Re-scan
            </button>
            <div className="flex-1" />
            <span className="text-xs text-gray-500">{selectedCount} selected</span>
            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className="rounded-md px-4 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              {importing ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  Importing...
                </>
              ) : (
                `Import ${selectedCount} class${selectedCount !== 1 ? "es" : ""}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
