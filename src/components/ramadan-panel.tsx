"use client";

import { useState, useEffect, useCallback } from "react";
import { isRamadan, getRamadanDay, getMoonPhase, toHijri, formatHijriMonthYear, getHijriOffset } from "@/lib/hijri";
import { createTask } from "@/lib/actions/tasks";

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
type Prayer = (typeof PRAYERS)[number];

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPrayerKey(date: string): string {
  return `prayer-tracker-${date}`;
}

function getFastingKey(date: string): string {
  return `fasting-tracker-${date}`;
}

/** Collect all dates marked as "didn't fast" from localStorage */
function getMissedFastDays(): string[] {
  const days: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("fasting-tracker-") && localStorage.getItem(key) === "true") {
        days.push(key.replace("fasting-tracker-", ""));
      }
    }
  } catch { /* ignore */ }
  return days.sort();
}

interface MadeUpEntry {
  missedDate: string;
  madeUpOn: string;
}

/** Collect all made-up fasts from localStorage */
function getMadeUpFasts(): MadeUpEntry[] {
  const entries: MadeUpEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("fasting-madeup-")) {
        const missedDate = key.replace("fasting-madeup-", "");
        const madeUpOn = localStorage.getItem(key) || "";
        if (madeUpOn) entries.push({ missedDate, madeUpOn });
      }
    }
  } catch { /* ignore */ }
  return entries.sort((a, b) => a.missedDate.localeCompare(b.missedDate));
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** SVG Lantern component */
function Lantern({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 120" className={className} fill="none">
      <line x1="30" y1="0" x2="30" y2="25" stroke="#c9a84c" strokeWidth="1.5" />
      <circle cx="30" cy="12" r="2" fill="#c9a84c" />
      <path d="M22 25 L38 25 L36 30 L24 30 Z" fill="#c9a84c" />
      <path
        d="M24 30 Q18 50 18 65 Q18 80 24 85 L36 85 Q42 80 42 65 Q42 50 36 30 Z"
        fill="url(#lanternGlow)"
        stroke="#c9a84c"
        strokeWidth="1.5"
      />
      <path d="M20 45 Q30 42 40 45" stroke="#c9a84c" strokeWidth="1" fill="none" />
      <path d="M19 60 Q30 57 41 60" stroke="#c9a84c" strokeWidth="1" fill="none" />
      <path d="M20 75 Q30 72 40 75" stroke="#c9a84c" strokeWidth="1" fill="none" />
      <path d="M24 85 L36 85 L34 92 L26 92 Z" fill="#c9a84c" />
      <path d="M28 92 L32 92 L30 100 Z" fill="#c9a84c" />
      <defs>
        <radialGradient id="lanternGlow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0.3" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Moon phase visual */
function MoonPhaseDisplay({ size = 80 }: { size?: number }) {
  const moon = getMoonPhase(new Date());
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const p = moon.phase;

  let d: string;
  if (p < 0.5) {
    const terminatorX = r * Math.cos(p * 2 * Math.PI);
    d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${Math.abs(terminatorX)} ${r} 0 0 ${p < 0.25 ? 1 : 0} ${cx} ${cy - r} Z`;
  } else {
    const terminatorX = r * Math.cos(p * 2 * Math.PI);
    d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${Math.abs(terminatorX)} ${r} 0 0 ${p < 0.75 ? 0 : 1} ${cx} ${cy - r} Z`;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-full bg-[#0a0a14] border border-[#2a2a3c] flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="#1a1a2a" />
          <circle cx={cx - r * 0.3} cy={cy - r * 0.2} r={r * 0.12} fill="#222235" opacity="0.5" />
          <circle cx={cx + r * 0.2} cy={cy + r * 0.3} r={r * 0.08} fill="#222235" opacity="0.4" />
          <circle cx={cx - r * 0.1} cy={cy + r * 0.5} r={r * 0.1} fill="#222235" opacity="0.3" />
          <path d={d} fill="url(#moonGradient)" />
          <defs>
            <radialGradient id="moonGradient" cx="40%" cy="40%">
              <stop offset="0%" stopColor="#f5f5dc" />
              <stop offset="100%" stopColor="#d4d4aa" />
            </radialGradient>
          </defs>
        </svg>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-gray-300">{moon.name}</p>
        <p className="text-[10px] text-gray-500">{Math.round(moon.illumination * 100)}% illuminated</p>
      </div>
    </div>
  );
}

interface RamadanPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated?: () => void;
  currentDate: Date;
}

type Tab = "today" | "missed" | "madeup";

export function RamadanPanel({ isOpen, onClose, onEventCreated }: RamadanPanelProps) {
  const today = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const [tab, setTab] = useState<Tab>("today");
  const [prayers, setPrayers] = useState<Record<Prayer, boolean>>({
    Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false,
  });
  const [didntFast, setDidntFast] = useState(false);
  const [creatingFastEvent, setCreatingFastEvent] = useState(false);
  const [creatingMissedTask, setCreatingMissedTask] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [missedDays, setMissedDays] = useState<string[]>([]);
  const [hijriOffset, setHijriOffset] = useState(() => getHijriOffset());
  const [madeUpPrompt, setMadeUpPrompt] = useState<string | null>(null);
  const [madeUpDate, setMadeUpDate] = useState(getTodayStr());
  const [madeUpEntries, setMadeUpEntries] = useState<MadeUpEntry[]>([]);

  const ramadanDay = getRamadanDay(new Date(selectedDate + "T12:00:00"));
  const hijri = toHijri(new Date(selectedDate + "T12:00:00"));
  const hijriHeader = formatHijriMonthYear(new Date(selectedDate + "T12:00:00"));

  // Load saved prayer/fasting state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(getPrayerKey(selectedDate));
      if (saved) {
        setPrayers(JSON.parse(saved));
      } else {
        setPrayers({ Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false });
      }
      const fastSaved = localStorage.getItem(getFastingKey(selectedDate));
      setDidntFast(fastSaved === "true");
    } catch {
      setPrayers({ Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false });
      setDidntFast(false);
    }
  }, [selectedDate]);

  // Load missed days and made-up entries when tab changes
  useEffect(() => {
    if (tab === "missed") {
      setMissedDays(getMissedFastDays());
    } else if (tab === "madeup") {
      setMadeUpEntries(getMadeUpFasts());
    }
  }, [tab, didntFast]);

  const togglePrayer = useCallback((prayer: Prayer) => {
    setPrayers((prev) => {
      const next = { ...prev, [prayer]: !prev[prayer] };
      localStorage.setItem(getPrayerKey(selectedDate), JSON.stringify(next));
      return next;
    });
  }, [selectedDate]);

  const allPrayersCompleted = PRAYERS.every((p) => prayers[p]);
  const missedPrayers = PRAYERS.filter((p) => !prayers[p]);

  const handleCreateMissedTasks = async () => {
    if (missedPrayers.length === 0) return;
    setCreatingMissedTask(true);
    try {
      for (const prayer of missedPrayers) {
        const formData = new FormData();
        formData.set("title", `🕌 Make up ${prayer} prayer (Qada)`);
        formData.set("durationMinutes", prayer === "Fajr" ? "10" : "15");
        formData.set("energyType", "light");
        formData.set("priority", "high");
        formData.set("taskStatus", "todo");
        await createTask(formData);
      }
      setShowSuccess(`Created ${missedPrayers.length} qada task${missedPrayers.length > 1 ? "s" : ""}`);
      setTimeout(() => setShowSuccess(null), 3000);
    } catch {
      // silent fail
    } finally {
      setCreatingMissedTask(false);
    }
  };

  const handleDidntFast = async () => {
    setCreatingFastEvent(true);
    try {
      const dateObj = new Date(selectedDate + "T12:00:00");
      // All-day event: start at midnight, end at 23:59
      const startISO = new Date(selectedDate + "T00:00:00").toISOString();
      const endISO = new Date(selectedDate + "T23:59:00").toISOString();

      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

      await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `💔 Didn't Fast — ${dayName}${ramadanDay ? ` (Ramadan ${ramadanDay})` : ""}`,
          date: selectedDate,
          startTime: startISO,
          endTime: endISO,
          color: "rose",
          availability: "free",
          allDay: true,
        }),
      });

      localStorage.setItem(getFastingKey(selectedDate), "true");
      setDidntFast(true);
      setShowSuccess("Logged — make up this fast later inshaAllah");
      setTimeout(() => setShowSuccess(null), 3000);
      onEventCreated?.();
    } catch {
      // silent fail
    } finally {
      setCreatingFastEvent(false);
    }
  };

  const handleUndoFast = () => {
    localStorage.removeItem(getFastingKey(selectedDate));
    setDidntFast(false);
  };

  const handleRemoveMissedDay = async (dateStr: string, madeUpOn: string) => {
    // Store when it was made up, then remove from missed list
    localStorage.setItem(`fasting-madeup-${dateStr}`, madeUpOn);
    localStorage.removeItem(getFastingKey(dateStr));
    setMissedDays((prev) => prev.filter((d) => d !== dateStr));
    if (dateStr === selectedDate) setDidntFast(false);
    setMadeUpPrompt(null);

    // Create all-day event for the makeup fast
    const rd = getRamadanDay(new Date(dateStr + "T12:00:00"));
    const originalLabel = formatShortDate(dateStr);
    try {
      await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `🌙 Made Up Fast — ${originalLabel}${rd ? ` (Ramadan ${rd})` : ""}`,
          date: madeUpOn,
          startTime: new Date(madeUpOn + "T00:00:00").toISOString(),
          endTime: new Date(madeUpOn + "T23:59:00").toISOString(),
          color: "emerald",
          availability: "free",
          allDay: true,
        }),
      });
      onEventCreated?.();
    } catch { /* silent */ }

    setShowSuccess(`Marked as made up on ${formatShortDate(madeUpOn)}`);
    setTimeout(() => setShowSuccess(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative lanterns */}
        <div className="absolute top-0 left-4 w-6 opacity-70 animate-pulse z-10" style={{ animationDuration: "3s" }}>
          <Lantern className="w-full h-auto" />
        </div>
        <div className="absolute top-0 right-4 w-5 opacity-50 animate-pulse z-10" style={{ animationDuration: "4s", animationDelay: "1s" }}>
          <Lantern className="w-full h-auto" />
        </div>

        {/* Header */}
        <div className="relative px-6 pt-5 pb-4 text-center border-b border-[#2a2a3c] flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-[#2a2a3c] transition-colors z-20"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          <div className="flex items-center justify-center gap-2 mb-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-amber-400">
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                fill="currentColor" opacity="0.2" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
            <h2 className="text-lg font-semibold text-amber-200">Muslim Tracker</h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-amber-400">
              <path d="M12 2L14.5 9H22L16 13.5L18 21L12 17L6 21L8 13.5L2 9H9.5L12 2Z" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-xs text-gray-500">{hijriHeader}</p>
          {ramadanDay !== null && (
            <p className="text-[11px] text-amber-400/70 mt-0.5">Day {ramadanDay} of Ramadan</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2a3c] flex-shrink-0">
          <button
            onClick={() => setTab("today")}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              tab === "today"
                ? "text-amber-300 border-b-2 border-amber-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Daily Tracker
          </button>
          <button
            onClick={() => setTab("missed")}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
              tab === "missed"
                ? "text-rose-300 border-b-2 border-rose-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Missed
            {missedDays.length > 0 && tab !== "missed" && (
              <span className="absolute top-1.5 ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] text-white font-bold">
                {missedDays.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("madeup")}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              tab === "madeup"
                ? "text-emerald-300 border-b-2 border-emerald-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Made Up
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "today" ? (
            <>
              {/* Date selector */}
              <div className="px-6 pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Date:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex-1 bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50 [color-scheme:dark]"
                  />
                  <button
                    onClick={() => setSelectedDate(today)}
                    className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-[#2a2a3c] transition-colors"
                  >
                    Today
                  </button>
                </div>
                {hijri.day > 0 && (
                  <div className="flex items-center justify-between mt-1 ml-10">
                    <p className="text-[10px] text-gray-600">
                      {hijri.day} {hijri.monthName} {hijri.year} AH
                    </p>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-600">Day offset:</span>
                      <select
                        value={hijriOffset}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setHijriOffset(v);
                          localStorage.setItem("hijri-offset", String(v));
                        }}
                        className="bg-[#12121c] border border-[#2a2a3c] rounded px-1 py-0.5 text-[9px] text-gray-400 focus:outline-none [color-scheme:dark]"
                      >
                        <option value="-1">-1 (Europe)</option>
                        <option value="0">0 (Saudi)</option>
                        <option value="1">+1</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Fasting Tracker */}
              <div className="px-6 py-3 border-t border-[#2a2a3c]">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Fasting</h3>
                {didntFast ? (
                  <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">💔</span>
                      <div>
                        <p className="text-sm text-rose-300">Didn&apos;t fast this day</p>
                        <p className="text-[10px] text-rose-400/60">Make it up later inshaAllah</p>
                      </div>
                    </div>
                    <button
                      onClick={handleUndoFast}
                      className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-[#2a2a3c] transition-colors"
                    >
                      Undo
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleDidntFast}
                    disabled={creatingFastEvent}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-rose-500/30 px-4 py-3 text-sm text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/50 transition-all disabled:opacity-50"
                  >
                    {creatingFastEvent ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-300/30 border-t-rose-300" />
                    ) : (
                      <span className="text-base">💔</span>
                    )}
                    Mark as &quot;Didn&apos;t Fast&quot;
                  </button>
                )}
              </div>

              {/* Prayer Tracker */}
              <div className="px-6 py-3 border-t border-[#2a2a3c]">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Daily Prayers</h3>
                <div className="space-y-1.5">
                  {PRAYERS.map((prayer) => (
                    <button
                      key={prayer}
                      onClick={() => togglePrayer(prayer)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                        prayers[prayer]
                          ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-300"
                          : "bg-[#12121c] border border-[#2a2a3c] text-gray-400 hover:border-[#3a3a4c] hover:text-gray-300"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors ${
                        prayers[prayer] ? "bg-emerald-500 border-emerald-500" : "border-gray-600"
                      }`}>
                        {prayers[prayer] && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="flex-1 text-left">{prayer}</span>
                      {prayers[prayer] && <span className="text-emerald-400/60 text-xs">Done</span>}
                    </button>
                  ))}
                </div>

                {allPrayersCompleted ? (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                    <span className="text-base">✅</span>
                    <p className="text-sm text-emerald-300">All prayers completed — MashaAllah!</p>
                  </div>
                ) : missedPrayers.length > 0 && missedPrayers.length < 5 ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Missing: {missedPrayers.join(", ")}</span>
                    </div>
                    <button
                      onClick={handleCreateMissedTasks}
                      disabled={creatingMissedTask}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/15 transition-colors disabled:opacity-50"
                    >
                      {creatingMissedTask ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300" />
                      ) : (
                        <span>🕌</span>
                      )}
                      Create Qada Tasks for Missed Prayers
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Moon Phase */}
              <div className="px-6 py-4 border-t border-[#2a2a3c]">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 text-center">Moon Phase — Tonight</h3>
                <MoonPhaseDisplay size={80} />
              </div>
            </>
          ) : tab === "missed" ? (
            /* Missed Fasts Tab */
            <div className="px-6 py-4">
              {missedDays.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-3xl mb-3 block">✅</span>
                  <p className="text-sm text-gray-400">No missed fasts recorded</p>
                  <p className="text-xs text-gray-600 mt-1">MashaAllah, keep it up!</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-rose-300">
                      {missedDays.length} day{missedDays.length !== 1 ? "s" : ""} to make up
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {missedDays.map((dateStr) => {
                      const rd = getRamadanDay(new Date(dateStr + "T12:00:00"));
                      const isPrompting = madeUpPrompt === dateStr;
                      return (
                        <div
                          key={dateStr}
                          className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">💔</span>
                              <div>
                                <p className="text-xs text-rose-200">{formatShortDate(dateStr)}</p>
                                {rd && <p className="text-[10px] text-rose-400/50">Ramadan Day {rd}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedDate(dateStr);
                                  setTab("today");
                                }}
                                className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-[#2a2a3c] transition-colors"
                              >
                                View
                              </button>
                              <button
                                onClick={() => {
                                  setMadeUpPrompt(isPrompting ? null : dateStr);
                                  setMadeUpDate(getTodayStr());
                                }}
                                className="text-[10px] text-gray-500 hover:text-emerald-300 px-1.5 py-0.5 rounded hover:bg-emerald-500/10 transition-colors"
                                title="Mark as made up"
                              >
                                Made up
                              </button>
                            </div>
                          </div>
                          {isPrompting && (
                            <div className="mt-2 pt-2 border-t border-rose-500/15 flex items-center gap-2">
                              <label className="text-[10px] text-gray-400 whitespace-nowrap">Made up on:</label>
                              <input
                                type="date"
                                value={madeUpDate}
                                onChange={(e) => setMadeUpDate(e.target.value)}
                                className="flex-1 bg-[#12121c] border border-[#2a2a3c] rounded px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]"
                              />
                              <button
                                onClick={() => handleRemoveMissedDay(dateStr, madeUpDate)}
                                className="text-[10px] text-emerald-300 hover:text-emerald-200 px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setMadeUpPrompt(null)}
                                className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-1 rounded hover:bg-[#2a2a3c] transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Made Up Fasts Tab */
            <div className="px-6 py-4">
              {madeUpEntries.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-3xl mb-3 block">📋</span>
                  <p className="text-sm text-gray-400">No made-up fasts yet</p>
                  <p className="text-xs text-gray-600 mt-1">Mark missed fasts as made up to see them here</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-emerald-300">
                      {madeUpEntries.length} fast{madeUpEntries.length !== 1 ? "s" : ""} made up
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {madeUpEntries.map((entry) => {
                      const rd = getRamadanDay(new Date(entry.missedDate + "T12:00:00"));
                      return (
                        <div
                          key={entry.missedDate}
                          className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🌙</span>
                            <div>
                              <p className="text-xs text-emerald-200">{formatShortDate(entry.missedDate)}</p>
                              {rd && <p className="text-[10px] text-emerald-400/50">Ramadan Day {rd}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-gray-400">
                              Made up {formatShortDate(entry.madeUpOn)}
                            </p>
                            <button
                              onClick={() => {
                                // Undo: move back to missed
                                localStorage.removeItem(`fasting-madeup-${entry.missedDate}`);
                                localStorage.setItem(getFastingKey(entry.missedDate), "true");
                                setMadeUpEntries((prev) => prev.filter((e) => e.missedDate !== entry.missedDate));
                              }}
                              className="text-[10px] text-gray-600 hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-[#2a2a3c] transition-colors"
                              title="Move back to missed"
                            >
                              Undo
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Success toast */}
        {showSuccess && (
          <div className="absolute bottom-4 left-4 right-4 bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-4 py-2 text-sm text-emerald-300 text-center">
            {showSuccess}
          </div>
        )}
      </div>
    </div>
  );
}
