"use client";

import { useState } from "react";
import { generateFollowUpQuestions, generateProjectWithAI } from "@/lib/actions/ai-project";
import { createProjectWithTasks } from "@/lib/actions/projects";
import type { FollowUpQuestion, GeneratedProject, GeneratedTask, ProjectColor } from "@/types";

interface AIProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const DOT_COLORS: Record<string, string> = {
  indigo: "bg-indigo-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  cyan: "bg-cyan-400",
  violet: "bg-violet-400",
  orange: "bg-orange-400",
};

const COLOR_OPTIONS: ProjectColor[] = ["indigo", "emerald", "amber", "rose", "cyan", "violet", "orange"];

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-emerald-400",
};

const ENERGY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  deep: { bg: "bg-indigo-500/20", text: "text-indigo-300", label: "Deep" },
  light: { bg: "bg-emerald-500/20", text: "text-emerald-300", label: "Light" },
  admin: { bg: "bg-amber-500/20", text: "text-amber-300", label: "Admin" },
};

type Step = "describe" | "refine" | "preview";
const STEPS: { key: Step; label: string }[] = [
  { key: "describe", label: "Describe" },
  { key: "refine", label: "Refine" },
  { key: "preview", label: "Preview" },
];

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-0 px-6 py-4 border-b border-[#2a2a3c]">
      {STEPS.map((s, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <div key={s.key} className="flex items-center">
            {i > 0 && (
              <div className={`w-12 h-px ${isDone ? "bg-purple-500" : "bg-[#2a2a3c]"}`} />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-purple-500 text-white ring-2 ring-purple-500/30"
                    : isDone
                    ? "bg-purple-500/80 text-white"
                    : "bg-[#2a2a3c] text-gray-500"
                }`}
              >
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? "text-purple-300" : isDone ? "text-gray-400" : "text-gray-600"}`}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuestionCard({
  q,
  value,
  onChange,
}: {
  q: FollowUpQuestion;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="rounded-lg bg-[#12121c] border border-[#2a2a3c] p-4 space-y-3">
      <p className="text-sm text-gray-200 font-medium">{q.question}</p>

      {q.type === "text" && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder || "Type your answer..."}
          className="w-full rounded-lg bg-[#1e1e30] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-purple-500 focus:outline-none"
        />
      )}

      {q.type === "date" && (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg bg-[#1e1e30] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 focus:border-purple-500 focus:outline-none [color-scheme:dark]"
        />
      )}

      {q.type === "number" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={q.placeholder || "0"}
            className="w-24 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-purple-500 focus:outline-none"
          />
          <span className="text-xs text-gray-500">hours</span>
        </div>
      )}

      {q.type === "select" && q.options && (
        <div className="flex flex-wrap gap-2">
          {q.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                value === opt
                  ? "bg-purple-500 text-white"
                  : "bg-[#1e1e30] text-gray-400 border border-[#2a2a3c] hover:border-purple-500/50 hover:text-gray-200"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AIProjectModal({ isOpen, onClose, onCreated }: AIProjectModalProps) {
  const [step, setStep] = useState<Step>("describe");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 state
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Step 3 state
  const [project, setProject] = useState<GeneratedProject | null>(null);

  if (!isOpen) return null;

  const handleContinue = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const result = await generateFollowUpQuestions(prompt);
      setQuestions(result.questions);
      setAnswers({});
      setStep("refine");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate questions");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const answerPairs = questions
        .filter((q) => answers[q.id]?.trim())
        .map((q) => ({ question: q.question, answer: answers[q.id] }));

      const result = await generateProjectWithAI(prompt, answerPairs);
      setProject(result);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!project) return;
    setSaving(true);
    setError(null);

    try {
      await createProjectWithTasks({
        name: project.name,
        description: project.description,
        color: project.color,
        tasks: project.tasks,
      });
      onCreated();
      handleClose();
    } catch {
      setError("Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep("describe");
    setPrompt("");
    setQuestions([]);
    setAnswers({});
    setProject(null);
    setError(null);
    onClose();
  };

  const updateProjectField = <K extends keyof GeneratedProject>(key: K, value: GeneratedProject[K]) => {
    if (project) setProject({ ...project, [key]: value });
  };

  const updateTask = (index: number, updates: Partial<GeneratedTask>) => {
    if (!project) return;
    const tasks = [...project.tasks];
    tasks[index] = { ...tasks[index], ...updates };
    setProject({ ...project, tasks });
  };

  const removeTask = (index: number) => {
    if (!project) return;
    setProject({ ...project, tasks: project.tasks.filter((_, i) => i !== index) });
  };

  // Stats for preview
  const totalMinutes = project?.tasks.reduce((sum, t) => sum + t.durationMinutes, 0) ?? 0;
  const taskCount = project?.tasks.length ?? 0;
  const energyCounts = project?.tasks.reduce(
    (acc, t) => {
      acc[t.energyType] = (acc[t.energyType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) ?? {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3c] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="text-purple-300">
                <path d="M8 1l2 5h5l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5z" fill="currentColor" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-100">AI Project Generator</h2>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Step Indicator */}
        <StepIndicator current={step} />

        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">{error}</div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Step 1: Describe ── */}
          {step === "describe" && (
            <div className="space-y-4">
              <div className="text-center space-y-2 mb-2">
                <div className="text-3xl">&#10024;</div>
                <p className="text-sm text-gray-400">
                  Describe your project and AI will help you create a detailed plan.
                </p>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="e.g. Edit 20 YouTube shorts, each about 3 hours of work. Need to film, edit, add captions, and upload them all..."
                className="w-full rounded-lg bg-[#12121c] border border-[#2a2a3c] px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:border-purple-500 focus:outline-none resize-none leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleContinue();
                }}
              />
            </div>
          )}

          {/* ── Step 2: Refine ── */}
          {step === "refine" && (
            <div className="space-y-3">
              <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 mb-1">
                <p className="text-xs text-purple-300 leading-relaxed">
                  <span className="font-semibold">Your project:</span> {prompt.length > 100 ? prompt.slice(0, 100) + "..." : prompt}
                </p>
              </div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Answer a few questions</p>
              {questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  value={answers[q.id] || ""}
                  onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
                />
              ))}
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === "preview" && project && (
            <div className="space-y-4">
              {/* Project header card */}
              <div className="rounded-lg bg-[#12121c] border border-[#2a2a3c] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={project.name}
                      onChange={(e) => updateProjectField("name", e.target.value)}
                      className="w-full bg-transparent text-base font-semibold text-gray-100 focus:outline-none border-b border-transparent focus:border-purple-500/50 pb-0.5"
                    />
                    <textarea
                      value={project.description}
                      onChange={(e) => updateProjectField("description", e.target.value)}
                      rows={2}
                      className="w-full bg-transparent text-xs text-gray-400 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateProjectField("color", c)}
                      className={`w-5 h-5 rounded-full ${DOT_COLORS[c]} transition-all ${
                        project.color === c ? "ring-2 ring-white ring-offset-1 ring-offset-[#12121c] scale-110" : "opacity-60 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Stats bar */}
              <div className="flex items-center gap-4 px-1">
                <span className="text-xs text-gray-500">
                  <span className="text-gray-300 font-semibold">{taskCount}</span> tasks
                </span>
                <span className="text-xs text-gray-600">·</span>
                <span className="text-xs text-gray-500">
                  <span className="text-gray-300 font-semibold">{formatDuration(totalMinutes)}</span> total
                </span>
                {Object.entries(energyCounts).map(([type, count]) => {
                  const badge = ENERGY_BADGE[type];
                  if (!badge) return null;
                  return (
                    <span key={type} className={`text-[10px] px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                      {count} {badge.label}
                    </span>
                  );
                })}
              </div>

              {/* Task list */}
              <div className="space-y-2">
                {project.tasks.map((task, i) => {
                  const badge = ENERGY_BADGE[task.energyType];
                  return (
                    <div
                      key={i}
                      className="group rounded-lg bg-[#12121c] border border-[#2a2a3c] p-3 hover:border-[#3a3a4c] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Priority dot */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />

                        {/* Editable title */}
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => updateTask(i, { title: e.target.value })}
                          className="flex-1 bg-transparent text-sm text-gray-200 focus:outline-none min-w-0"
                        />

                        {/* Duration chip */}
                        <span className="text-[10px] text-gray-500 bg-[#1e1e30] px-2 py-0.5 rounded-full flex-shrink-0">
                          {formatDuration(task.durationMinutes)}
                        </span>

                        {/* Energy badge */}
                        {badge && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={() => removeTask(i)}
                          className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>

                      {/* Inline priority/energy selects */}
                      <div className="flex items-center gap-3 mt-1.5 pl-[18px]">
                        <select
                          value={task.priority}
                          onChange={(e) => updateTask(i, { priority: e.target.value as GeneratedTask["priority"] })}
                          className="bg-transparent text-[10px] text-gray-600 focus:outline-none cursor-pointer hover:text-gray-400"
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <select
                          value={task.energyType}
                          onChange={(e) => updateTask(i, { energyType: e.target.value as GeneratedTask["energyType"] })}
                          className="bg-transparent text-[10px] text-gray-600 focus:outline-none cursor-pointer hover:text-gray-400"
                        >
                          <option value="deep">Deep</option>
                          <option value="light">Light</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-[#2a2a3c] flex-shrink-0">
          {step === "describe" && (
            <button
              onClick={handleContinue}
              disabled={loading || !prompt.trim()}
              className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Analyzing...
                </>
              ) : (
                "Continue"
              )}
            </button>
          )}

          {step === "refine" && (
            <>
              <button
                onClick={() => setStep("describe")}
                className="rounded-lg bg-[#2a2a3c] px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-[#3a3a4c] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Generating Plan...
                  </>
                ) : (
                  "Generate Plan"
                )}
              </button>
            </>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={() => setStep("refine")}
                className="rounded-lg bg-[#2a2a3c] px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-[#3a3a4c] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !project?.tasks.length}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving...
                  </>
                ) : (
                  <>Save Project ({taskCount} tasks)</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
