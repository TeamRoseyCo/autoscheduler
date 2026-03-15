"use client";

import { useState, useEffect, useTransition } from "react";
import { AppleEmoji } from "@/components/apple-emoji";
import {
  generateHabitsForWeek,
  regenerateHabitsForWeek,
  getHabitsWeekStatus,
  deleteHabit,
  toggleHabitActive,
  createHabit,
  updateHabit,
  resolveHabitInstance,
  bulkResolveHabits,
} from "@/lib/actions/habits";
import type { HabitWithProject } from "@/lib/actions/habits";
import type { ProjectWithCounts } from "@/lib/actions/projects";

// ── Data ─────────────────────────────────────────────────────────────

const PRESETS = [
  { emoji: "🏋️", title: "Gym", duration: 60, energy: "light" as const, time: "morning" },
  { emoji: "📖", title: "Read", duration: 30, energy: "light" as const, time: "evening" },
  { emoji: "🎬", title: "Create video", duration: 90, energy: "deep" as const, time: "afternoon" },
  { emoji: "📚", title: "Study", duration: 45, energy: "deep" as const, time: "morning" },
  { emoji: "🧘", title: "Meditate", duration: 15, energy: "light" as const, time: "morning" },
  { emoji: "🏃", title: "Run", duration: 30, energy: "light" as const, time: "morning" },
  { emoji: "✍️", title: "Journal", duration: 15, energy: "light" as const, time: "evening" },
  { emoji: "🎸", title: "Practice instrument", duration: 30, energy: "light" as const, time: "evening" },
  { emoji: "💻", title: "Side project", duration: 60, energy: "deep" as const, time: "evening" },
  { emoji: "🗣️", title: "Language lesson", duration: 30, energy: "light" as const, time: "afternoon" },
];

const EMOJI_CHOICES = [
  "🏋️", "📖", "🎬", "📚", "🧘", "🏃", "✍️", "🎸", "💻", "🗣️",
  "🎯", "💪", "🧠", "🎨", "📝", "🎵", "🚴", "🧹", "💰", "📸",
  "🥗", "💊", "🛏️", "☕", "🎮", "🐕", "🧑‍🍳", "🪴", "💧", "🔄",
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ENERGY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  deep: { bg: "bg-indigo-500/15", text: "text-indigo-400", label: "Deep" },
  light: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Light" },
  admin: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Admin" },
};

const TIME_STYLES: Record<string, { icon: string; label: string }> = {
  morning: { icon: "🌅", label: "Morning" },
  afternoon: { icon: "☀️", label: "Afternoon" },
  evening: { icon: "🌙", label: "Evening" },
};

// ── Types ────────────────────────────────────────────────────────────

interface ReviewItem {
  id: string;
  habitId: string;
  habitTitle: string;
  taskId: string;
  date: string;
  status: string;
  taskCompleted: boolean;
  taskStatus: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function frequencyLabel(freq: string, timesPerWeek?: number | null): string {
  if (timesPerWeek) return `${timesPerWeek}x / week`;
  if (freq === "daily") return "Every day";
  if (freq === "weekdays") return "Weekdays";
  return freq.split(",").map((s) => DAY_FULL[parseInt(s.trim(), 10)] || s).join(", ");
}

function durationLabel(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function frequencyDots(freq: string, timesPerWeek?: number | null): boolean[] {
  if (timesPerWeek && timesPerWeek >= 1 && timesPerWeek <= 7) {
    const spreads: Record<number, number[]> = {
      1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5],
      5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6],
    };
    const active = new Set(spreads[timesPerWeek] || []);
    return [0, 1, 2, 3, 4, 5, 6].map((d) => active.has(d));
  }
  const active = new Set<number>();
  if (freq === "daily") [0, 1, 2, 3, 4, 5, 6].forEach((d) => active.add(d));
  else if (freq === "weekdays") [1, 2, 3, 4, 5].forEach((d) => active.add(d));
  else freq.split(",").forEach((s) => active.add(parseInt(s.trim(), 10)));
  return [0, 1, 2, 3, 4, 5, 6].map((d) => active.has(d));
}

// ── Main Component ───────────────────────────────────────────────────

export function HabitPanel({
  isOpen,
  onClose,
  onGenerated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onGenerated?: () => void;
}) {
  const [habits, setHabits] = useState<HabitWithProject[]>([]);
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [editingHabit, setEditingHabit] = useState<HabitWithProject | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [generating, startGenerate] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [weekStatus, setWeekStatus] = useState<{
    generated: boolean;
    total: number;
    scheduled: number;
    issues: number;
  } | null>(null);

  const refreshStatus = () => {
    getHabitsWeekStatus().then(setWeekStatus).catch(() => {});
  };

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/habits").then((r) => r.ok ? r.json() : []).then(setHabits).catch(() => {});
    fetch("/api/projects").then((r) => r.ok ? r.json() : []).then(setProjects).catch(() => {});
    refreshStatus();
    fetch("/api/habits/review?previous=true")
      .then((r) => r.ok ? r.json() : [])
      .then((items: ReviewItem[]) => {
        const incomplete = items.filter((i) => !i.taskCompleted && i.status === "pending");
        if (incomplete.length > 0) setReviewItems(items);
      })
      .catch(() => {});
  }, [isOpen]);

  const refresh = () => {
    fetch("/api/habits").then((r) => r.ok ? r.json() : []).then(setHabits).catch(() => {});
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerate = () => {
    startGenerate(async () => {
      const count = await generateHabitsForWeek();
      showToast(count > 0 ? `${count} habit${count !== 1 ? "s" : ""} scheduled to your calendar` : "All habits already scheduled this week");
      refreshStatus();
      onGenerated?.();
    });
  };

  const handleRegenerate = () => {
    startGenerate(async () => {
      const count = await regenerateHabitsForWeek();
      showToast(`${count} habit${count !== 1 ? "s" : ""} regenerated to your calendar`);
      refreshStatus();
      onGenerated?.();
    });
  };

  const handleQuickAdd = async (preset: typeof PRESETS[0]) => {
    const fd = new FormData();
    fd.set("title", preset.title);
    fd.set("emoji", preset.emoji);
    fd.set("durationMinutes", String(preset.duration));
    fd.set("frequency", "weekdays");
    fd.set("energyType", preset.energy);
    fd.set("preferredTime", preset.time);
    await createHabit(fd);
    refresh();
    showToast(`Added ${preset.emoji} ${preset.title}`);
  };

  const handleDelete = async (id: string) => {
    await deleteHabit(id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setConfirmDelete(null);
  };

  const handleToggle = async (id: string) => {
    await toggleHabitActive(id);
    setHabits((prev) => prev.map((h) => h.id === id ? { ...h, active: !h.active } : h));
  };

  const handleResolve = async (genId: string, action: "skip" | "reschedule") => {
    await resolveHabitInstance(genId, action);
    setReviewItems((prev) => prev.filter((i) => i.id !== genId));
    if (action === "reschedule") onGenerated?.();
  };

  const handleBulkSkip = async () => {
    const ids = reviewItems.filter((i) => !i.taskCompleted && i.status === "pending").map((i) => i.id);
    await bulkResolveHabits(ids, "skip");
    setReviewItems([]);
  };

  if (!isOpen) return null;

  const activeHabits = habits.filter((h) => h.active);
  const pausedHabits = habits.filter((h) => !h.active);
  const incompleteReview = reviewItems.filter((i) => !i.taskCompleted && i.status === "pending");
  const unusedPresets = PRESETS.filter((p) => !habits.some((h) => h.title.toLowerCase() === p.title.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[5vh] pb-[5vh] overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#16161f] border border-[#2a2a3c] rounded-2xl shadow-2xl w-full max-w-[720px] mx-4 flex flex-col max-h-[90vh]">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3c] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 flex items-center justify-center">
              <AppleEmoji emoji="🔄" size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Habits</h2>
              <p className="text-xs text-gray-500">{activeHabits.length} active{pausedHabits.length > 0 ? ` · ${pausedHabits.length} paused` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {weekStatus?.generated && weekStatus.issues > 0 ? (
              <button
                onClick={handleRegenerate}
                disabled={generating || activeHabits.length === 0}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-40 transition-colors inline-flex items-center gap-2"
              >
                {generating ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8a6 6 0 0111.5-2.3M14 8a6 6 0 01-11.5 2.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M14 2v4h-4M2 14v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                Regenerate
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={generating || activeHabits.length === 0}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors inline-flex items-center gap-2"
              >
                {generating ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8a6 6 0 0111.5-2.3M14 8a6 6 0 01-11.5 2.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M14 2v4h-4M2 14v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                Generate This Week
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-[#2a2a3c]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Scheduling issues banner */}
          {weekStatus?.generated && weekStatus.issues > 0 && (
            <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-4">
              <div className="flex items-center gap-2">
                <AppleEmoji emoji="⚠️" size={16} />
                <span className="text-sm text-amber-300">
                  {weekStatus.issues} habit{weekStatus.issues !== 1 ? "s" : ""} not scheduled on {weekStatus.issues !== 1 ? "their" : "its"} correct day
                </span>
                <span className="text-xs text-gray-600 ml-auto">
                  {weekStatus.scheduled}/{weekStatus.total} properly scheduled
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Tasks may have been deleted or couldn&apos;t fit on their assigned day. Click &quot;Regenerate&quot; above to fix.
              </p>
            </div>
          )}

          {/* Review banner */}
          {incompleteReview.length > 0 && (
            <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AppleEmoji emoji="⚠️" size={16} />
                  <span className="text-sm font-medium text-amber-300">{incompleteReview.length} missed from last week</span>
                </div>
                <button onClick={handleBulkSkip} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded-md hover:bg-[#2a2a3c] transition-colors">
                  Skip all
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {incompleteReview.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg bg-[#12121c] px-3 py-2">
                    <span className="text-sm text-gray-300 truncate flex-1">{item.habitTitle}</span>
                    <button
                      onClick={() => handleResolve(item.id, "reschedule")}
                      className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors flex-shrink-0"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => handleResolve(item.id, "skip")}
                      className="text-xs text-gray-500 hover:text-gray-300 flex-shrink-0"
                    >
                      Skip
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state with presets */}
          {habits.length === 0 && !showForm && (
            <div>
              <p className="text-sm text-gray-400 mb-3">Pick habits to build your routine, or create a custom one:</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.title}
                    onClick={() => handleQuickAdd(p)}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-[#2a2a3c] px-3 py-3 hover:bg-[#1e1e30] hover:border-indigo-500/30 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#1e1e30] group-hover:bg-indigo-600/15 flex items-center justify-center transition-colors">
                      <AppleEmoji emoji={p.emoji} size={24} />
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">{p.title}</span>
                    <span className="text-[10px] text-gray-600">{durationLabel(p.duration)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active habits grid */}
          {activeHabits.length > 0 && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeHabits.map((habit) => {
                  const es = ENERGY_STYLES[habit.energyType] || ENERGY_STYLES.light;
                  const dots = frequencyDots(habit.frequency, habit.timesPerWeek);
                  const isDeleting = confirmDelete === habit.id;

                  return (
                    <div
                      key={habit.id}
                      className="group rounded-xl bg-[#12121c] border border-[#2a2a3c] hover:border-[#3a3a4c] transition-all overflow-hidden"
                    >
                      <div className="flex items-start gap-3 p-4">
                        <button
                          onClick={() => { setEditingHabit(habit); setShowForm(true); }}
                          className="w-11 h-11 rounded-xl bg-[#1e1e30] flex items-center justify-center flex-shrink-0 hover:bg-[#2a2a3c] transition-colors"
                        >
                          <AppleEmoji emoji={habit.emoji} size={26} />
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-100 truncate">{habit.title}</p>
                            {habit.project && (
                              <span className="text-[10px] text-gray-600 truncate flex-shrink-0">{habit.project.name}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-gray-500">{durationLabel(habit.durationMinutes)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${es.bg} ${es.text}`}>{es.label}</span>
                            {habit.timesPerWeek && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">{habit.timesPerWeek}x/wk</span>
                            )}
                            {habit.deadlineTime && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/12 text-red-400">by {habit.deadlineTime}</span>
                            )}
                            {habit.preferredTime && TIME_STYLES[habit.preferredTime] && (
                              <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                                <AppleEmoji emoji={TIME_STYLES[habit.preferredTime].icon} size={10} />
                                {TIME_STYLES[habit.preferredTime].label}
                              </span>
                            )}
                          </div>

                          {/* Day dots */}
                          <div className="flex items-center gap-1 mt-2">
                            {dots.map((on, i) => (
                              <div key={i} className="flex flex-col items-center">
                                <div className={`w-5 h-5 rounded-full text-[9px] font-medium flex items-center justify-center ${
                                  on ? "bg-indigo-600/30 text-indigo-300" : "bg-[#1e1e30] text-gray-700"
                                }`}>
                                  {DAY_LABELS[i]}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => { setEditingHabit(habit); setShowForm(true); }}
                            className="p-1 rounded-md text-gray-600 hover:text-gray-300 hover:bg-[#2a2a3c] transition-colors"
                            title="Edit"
                          >
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleToggle(habit.id)}
                            className="p-1 rounded-md text-gray-600 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                            title="Pause"
                          >
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <rect x="4" y="3" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="3" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => isDeleting ? handleDelete(habit.id) : setConfirmDelete(habit.id)}
                            className={`p-1 rounded-md transition-colors ${isDeleting ? "text-red-400 bg-red-500/15" : "text-gray-600 hover:text-red-400 hover:bg-red-500/10"}`}
                            title={isDeleting ? "Click again to confirm" : "Delete"}
                            onBlur={() => setConfirmDelete(null)}
                          >
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Paused habits */}
          {pausedHabits.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-600 uppercase tracking-wider mb-2">Paused</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pausedHabits.map((habit) => (
                  <div key={habit.id} className="flex items-center gap-3 rounded-xl bg-[#12121c]/50 border border-[#2a2a3c]/50 px-4 py-3 opacity-50 hover:opacity-80 transition-opacity">
                    <AppleEmoji emoji={habit.emoji} size={20} />
                    <span className="text-sm text-gray-400 truncate flex-1">{habit.title}</span>
                    <button
                      onClick={() => handleToggle(habit.id)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors flex-shrink-0"
                    >
                      Resume
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add habit / quick presets */}
          {!showForm && (
            <div className="flex items-start gap-3">
              <button
                onClick={() => { setEditingHabit(null); setShowForm(true); }}
                className="rounded-xl border-2 border-dashed border-[#2a2a3c] hover:border-indigo-500/30 px-4 py-3 text-sm text-gray-500 hover:text-gray-300 hover:bg-[#1e1e30] transition-all flex items-center gap-2 flex-shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Custom habit
              </button>

              {habits.length > 0 && unusedPresets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {unusedPresets.slice(0, 5).map((p) => (
                    <button
                      key={p.title}
                      onClick={() => handleQuickAdd(p)}
                      className="rounded-lg border border-[#2a2a3c] px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-[#1e1e30] hover:border-[#3a3a4c] transition-all flex items-center gap-1.5"
                    >
                      <AppleEmoji emoji={p.emoji} size={14} />
                      {p.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Inline form */}
          {showForm && (
            <HabitForm
              habit={editingHabit}
              projects={projects}
              onDone={() => { setShowForm(false); setEditingHabit(null); refresh(); }}
              onCancel={() => { setShowForm(false); setEditingHabit(null); }}
            />
          )}
        </div>

        {/* ── Toast ─────────────────────────────────────────── */}
        {toast && (
          <div className="flex items-center justify-center px-6 py-3 border-t border-[#2a2a3c] bg-emerald-500/8 flex-shrink-0">
            <span className="text-sm text-emerald-400">{toast}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Habit Form ───────────────────────────────────────────────────────

function HabitForm({
  habit,
  projects,
  onDone,
  onCancel,
}: {
  habit: HabitWithProject | null;
  projects: ProjectWithCounts[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [emoji, setEmoji] = useState(habit?.emoji || "🔄");
  const [title, setTitle] = useState(habit?.title || "");
  const [duration, setDuration] = useState(habit?.durationMinutes || 30);
  const [freqMode, setFreqMode] = useState<"daily" | "weekdays" | "custom" | "weekly">(
    habit
      ? habit.timesPerWeek
        ? "weekly"
        : habit.frequency === "daily"
          ? "daily"
          : habit.frequency === "weekdays"
            ? "weekdays"
            : "custom"
      : "weekdays"
  );
  const [customDays, setCustomDays] = useState<number[]>(
    habit && habit.frequency !== "daily" && habit.frequency !== "weekdays"
      ? habit.frequency.split(",").map((s) => parseInt(s.trim(), 10))
      : [1, 3, 5]
  );
  const [timesPerWeek, setTimesPerWeek] = useState(habit?.timesPerWeek || 3);
  const [deadlineTime, setDeadlineTime] = useState(habit?.deadlineTime || "");
  const [energy, setEnergy] = useState(habit?.energyType || "light");
  const [time, setTime] = useState(habit?.preferredTime || "");
  const [projectId, setProjectId] = useState(habit?.projectId || "");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const getFreq = () => {
    if (freqMode === "weekly") return "daily"; // placeholder — timesPerWeek drives generation
    if (freqMode === "daily") return "daily";
    if (freqMode === "weekdays") return "weekdays";
    return customDays.sort((a, b) => a - b).join(",");
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("emoji", emoji);
    fd.set("durationMinutes", String(duration));
    fd.set("frequency", getFreq());
    if (freqMode === "weekly") fd.set("timesPerWeek", String(timesPerWeek));
    if (deadlineTime) fd.set("deadlineTime", deadlineTime);
    fd.set("energyType", energy);
    fd.set("preferredTime", time);
    fd.set("projectId", projectId);
    try {
      if (habit) await updateHabit(habit.id, fd);
      else await createHabit(fd);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-[#12121c] border border-[#2a2a3c] p-5 space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <p className="text-sm font-medium text-gray-200">{habit ? "Edit habit" : "New habit"}</p>
      </div>

      {/* Emoji + Title */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-12 h-12 rounded-xl bg-[#1e1e30] border border-[#2a2a3c] flex items-center justify-center hover:border-indigo-500/30 transition-colors"
          >
            <AppleEmoji emoji={emoji} size={26} />
          </button>
          {showEmojiPicker && (
            <div className="absolute top-full left-0 mt-2 z-50 bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl p-3 grid grid-cols-6 gap-1.5 w-[230px]">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  onClick={() => { setEmoji(e); setShowEmojiPicker(false); }}
                  className="w-8 h-8 rounded-lg hover:bg-[#2a2a3c] flex items-center justify-center transition-colors"
                >
                  <AppleEmoji emoji={e} size={20} />
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you want to do daily?"
          autoFocus
          className="flex-1 bg-[#1e1e30] border border-[#2a2a3c] rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
          onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) handleSubmit(); }}
        />
      </div>

      {/* Duration */}
      <div>
        <label className="block text-xs text-gray-500 mb-2">Duration</label>
        <div className="flex flex-wrap gap-1.5">
          {[15, 30, 45, 60, 90, 120].map((m) => (
            <button
              key={m}
              onClick={() => setDuration(m)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                duration === m
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                  : "bg-[#1e1e30] text-gray-500 hover:text-gray-300 hover:bg-[#2a2a3c]"
              }`}
            >
              {m < 60 ? `${m} min` : `${m / 60} hour${m > 60 ? "s" : ""}`}
            </button>
          ))}
        </div>
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-xs text-gray-500 mb-2">Repeat</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(["daily", "weekdays", "weekly", "custom"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setFreqMode(m)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                freqMode === m
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                  : "bg-[#1e1e30] text-gray-500 hover:text-gray-300 hover:bg-[#2a2a3c]"
              }`}
            >
              {m === "daily" ? "Every day" : m === "weekdays" ? "Weekdays" : m === "weekly" ? "X per week" : "Custom"}
            </button>
          ))}
        </div>
        {freqMode === "weekly" && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  onClick={() => setTimesPerWeek(n)}
                  className={`w-9 h-9 rounded-lg text-xs font-medium transition-all ${
                    timesPerWeek === n
                      ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                      : "bg-[#1e1e30] text-gray-600 hover:text-gray-400 hover:bg-[#2a2a3c]"
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-600">per week</span>
          </div>
        )}
        {freqMode === "custom" && (
          <div className="flex gap-1.5 mt-2">
            {DAY_FULL.map((label, idx) => (
              <button
                key={idx}
                onClick={() => setCustomDays((p) => p.includes(idx) ? p.filter((d) => d !== idx) : [...p, idx])}
                className={`w-10 h-10 rounded-lg text-xs font-medium transition-all ${
                  customDays.includes(idx)
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "bg-[#1e1e30] text-gray-600 hover:text-gray-400 hover:bg-[#2a2a3c]"
                }`}
              >
                {label.slice(0, 3)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Deadline time */}
      <div>
        <label className="block text-xs text-gray-500 mb-2">Must be done by</label>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={deadlineTime}
            onChange={(e) => setDeadlineTime(e.target.value)}
            className="bg-[#1e1e30] border border-[#2a2a3c] rounded-lg px-3 py-2 text-xs text-gray-300 focus:border-indigo-500/40 focus:outline-none transition-colors"
          />
          {deadlineTime && (
            <button
              onClick={() => setDeadlineTime("")}
              className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1 rounded-md hover:bg-[#2a2a3c] transition-colors"
            >
              Clear (end of day)
            </button>
          )}
          {!deadlineTime && (
            <span className="text-xs text-gray-600">No deadline — scheduled anytime</span>
          )}
        </div>
      </div>

      {/* Time + Energy + Project */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Time</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full text-xs bg-[#1e1e30] border border-[#2a2a3c] rounded-lg px-3 py-2 text-gray-300 focus:border-indigo-500/40 focus:outline-none transition-colors"
          >
            <option value="">Any time</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Energy</label>
          <select
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
            className="w-full text-xs bg-[#1e1e30] border border-[#2a2a3c] rounded-lg px-3 py-2 text-gray-300 focus:border-indigo-500/40 focus:outline-none transition-colors"
          >
            <option value="deep">Deep focus</option>
            <option value="light">Light</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full text-xs bg-[#1e1e30] border border-[#2a2a3c] rounded-lg px-3 py-2 text-gray-300 focus:border-indigo-500/40 focus:outline-none transition-colors"
          >
            <option value="">None</option>
            {projects.filter((p) => p.status === "active").map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors shadow-lg shadow-indigo-600/20"
        >
          {saving ? "Saving..." : habit ? "Save Changes" : "Add Habit"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-300 hover:bg-[#2a2a3c] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
