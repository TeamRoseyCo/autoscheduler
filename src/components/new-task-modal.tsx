"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createTask } from "@/lib/actions/tasks";
import { categorizeTask } from "@/lib/categorize";
import { EmojiPicker } from "@/components/emoji-picker";
import { DescriptionWand } from "@/components/description-wand";
import type { ProjectWithCounts } from "@/lib/actions/projects";

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  projects: ProjectWithCounts[];
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

const PRIORITY_OPTIONS = [
  { value: "asap", label: "ASAP", color: "text-red-500", dot: "bg-red-500" },
  { value: "high", label: "High", color: "text-red-400", dot: "bg-red-400" },
  { value: "medium", label: "Medium", color: "text-amber-400", dot: "bg-amber-400" },
  { value: "low", label: "Low", color: "text-blue-400", dot: "bg-blue-400" },
];

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do", icon: "○", color: "text-gray-400" },
  { value: "in_progress", label: "In Progress", icon: "◑", color: "text-blue-400" },
  { value: "blocked", label: "Blocked", icon: "◉", color: "text-orange-400" },
];

const ENERGY_OPTIONS = [
  { value: "deep", label: "Deep Focus", sublabel: "Work hours" },
  { value: "light", label: "Light Work", sublabel: "Flexible" },
  { value: "admin", label: "Admin", sublabel: "Anytime" },
];

const TIME_WINDOW_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function NewTaskModal({ isOpen, onClose, onCreated, projects }: NewTaskModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [title, setTitle] = useState("");
  const [energyType, setEnergyType] = useState("deep");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [startDate, setStartDate] = useState(getTodayStr());
  const [preferredTime, setPreferredTime] = useState("");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState("todo");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setDuration(30);
      setEnergyType("deep");
      setPriority("medium");
      setDeadline("");
      setStartDate(getTodayStr());
      setPreferredTime("");
      setProjectId("");
      setTaskStatus("todo");
      setError(null);
      setSaving(false);
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        document.getElementById("task-form-submit")?.click();
      }
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

  const handleTitleBlur = () => {
    if (!title.trim()) return;
    const result = categorizeTask(title);
    setEnergyType(result.energyType);
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("durationMinutes", String(duration));
      formData.set("energyType", energyType);
      formData.set("priority", priority);
      formData.set("deadline", deadline);
      formData.set("preferredTimeWindow", preferredTime);
      formData.set("projectId", projectId);
      formData.set("taskStatus", taskStatus);
      await createTask(formData);
      onCreated();
      onClose();
    } catch {
      setError("Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedPriority = PRIORITY_OPTIONS.find((p) => p.value === priority) || PRIORITY_OPTIONS[1];
  const selectedEnergy = ENERGY_OPTIONS.find((e) => e.value === energyType) || ENERGY_OPTIONS[0];

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-4xl bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl min-h-[600px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main content - two columns */}
        <div className="flex flex-1 min-h-0">
          {/* Left column - Title + Description */}
          <div className="flex-1 p-6 flex flex-col border-r border-[#2a2a3c]" style={{ flexBasis: "55%" }}>
            {/* Title with emoji */}
            <div className="flex items-center gap-1 mb-4">
              <EmojiPicker onSelect={handleEmojiSelect} />
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                required
                placeholder="Task name"
                className="flex-1 bg-transparent text-xl font-semibold text-gray-100 placeholder-gray-600 focus:outline-none"
              />
            </div>

            {/* Description textarea */}
            <div className="flex-1 flex flex-col">
              {/* Toolbar: label + AI wand */}
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#2a2a3c]">
                <span className="text-xs font-medium text-gray-500">Description</span>
                <DescriptionWand title={title} onGenerated={setDescription} />
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description… or use ✨ AI Write"
                className="flex-1 w-full bg-transparent text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none leading-relaxed"
              />
            </div>

            {/* Attachments placeholder */}
            <div className="flex items-center gap-2 pt-3 mt-3 border-t border-[#2a2a3c]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-600">
                <path d="M13.5 7.5l-5.3 5.3a3.5 3.5 0 01-5-5l5.3-5.3a2.3 2.3 0 013.3 3.3l-5.3 5.3a1.2 1.2 0 01-1.7-1.7L10 4.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs text-gray-600">Attachments</span>
            </div>
          </div>

          {/* Right column - Properties sidebar */}
          <div className="flex flex-col p-5 space-y-4 overflow-y-auto" style={{ flexBasis: "45%" }}>
            {/* Project dropdown */}
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
                <path d="M2 4.5A1.5 1.5 0 013.5 3H6l1 1.5h5.5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="flex-1 bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50"
              >
                <option value="">No project</option>
                {projects.filter((p) => p.status === "active").map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Auto-scheduled badge */}
            <div className="flex items-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-300 border border-violet-500/20">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.8 2.8l1.4 1.4M7.8 7.8l1.4 1.4M2.8 9.2l1.4-1.4M7.8 4.2l1.4-1.4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
                Auto-scheduled (Pending)
              </span>
            </div>

            {/* Status row */}
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <div className="flex gap-1.5 flex-wrap">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setTaskStatus(s.value)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
                      taskStatus === s.value
                        ? "bg-[#2a2a3c] text-gray-100 ring-1 ring-indigo-500/40"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <span className={s.color}>{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-[#2a2a3c]" />

            {/* Priority */}
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
                <path d="M3 13V3l8 4-8 4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <div className="flex-1">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className={`w-2 h-2 rounded-full ${selectedPriority.dot}`} />
            </div>

            {/* Duration */}
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm text-gray-300 w-12">{formatDuration(duration)}</span>
              <div className="flex flex-wrap gap-1 flex-1">
                {DURATION_PRESETS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDuration(mins)}
                    className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                      duration === mins
                        ? "bg-indigo-600 text-white"
                        : "bg-[#2a2a3c] text-gray-400 hover:bg-[#3a3a4c]"
                    }`}
                  >
                    {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-[#2a2a3c]" />

            {/* Start date */}
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
                <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="text-xs text-gray-500 w-16">Start</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
              />
            </div>

            {/* Deadline */}
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
                <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="8" cy="9.5" r="1" fill="currentColor" />
              </svg>
              <span className="text-xs text-gray-500 w-16">Deadline</span>
              <input
                type="date"
                name="deadline"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="flex-1 bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
              />
            </div>

            <div className="h-px bg-[#2a2a3c]" />

            {/* Energy Type / Schedule */}
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
                <path d="M9 1L4 9h4l-1 6 5-8H8l1-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <div className="flex-1">
                <select
                  value={energyType}
                  onChange={(e) => setEnergyType(e.target.value)}
                  className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50"
                >
                  {ENERGY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label} — {opt.sublabel}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preferred Time */}
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 flex-shrink-0">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 5v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex-1">
                <select
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50"
                >
                  {TIME_WINDOW_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">{error}</div>
        )}

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2a2a3c]">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors"
          >
            Cancel
            <kbd className="text-[10px] text-gray-600 bg-[#12121c] border border-[#2a2a3c] rounded px-1.5 py-0.5">Esc</kbd>
          </button>
          <button
            id="task-form-submit"
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </>
            ) : (
              <>
                Save task
                <kbd className="text-[10px] text-indigo-300/60 bg-indigo-700/50 border border-indigo-500/30 rounded px-1.5 py-0.5">Ctrl+S</kbd>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
