"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createTask, updateTask } from "@/lib/actions/tasks";
import type { Task } from "@/generated/prisma/client";
import type { ProjectWithCounts } from "@/lib/actions/projects";
import { MetricPicker, type MetricOption } from "@/components/metric-picker";
import { AppleEmoji } from "@/components/apple-emoji";

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

interface TaskWithMetric extends Task {
  metric?: { id: string; name: string; unit: string; icon: string } | null;
}

export function TaskForm({
  task,
  onDone,
}: {
  task?: TaskWithMetric;
  onDone?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [metrics, setMetrics] = useState<MetricOption[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<MetricOption | null>(
    task?.metric ? { ...task.metric, category: "" } : null
  );
  const [isSuggestingMetric, setIsSuggestingMetric] = useState(false);
  const [titleValue, setTitleValue] = useState(task?.title ?? "");

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.ok ? res.json() : [])
      .then(setProjects)
      .catch(() => {});

    fetch("/api/metrics")
      .then((res) => res.ok ? res.json() : [])
      .then(setMetrics)
      .catch(() => {});
  }, []);

  const handleAutoDetect = async () => {
    if (!titleValue.trim()) return;
    setIsSuggestingMetric(true);
    try {
      const res = await fetch("/api/metrics/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleValue }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.metric) setSelectedMetric(data.metric);
      }
    } finally {
      setIsSuggestingMetric(false);
    }
  };

  // (metrics grouped by category handled inside MetricPicker)

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      // Inject selected metric id into form data
      if (selectedMetric) {
        formData.set("metricId", selectedMetric.id);
      } else {
        formData.delete("metricId");
      }
      try {
        if (task) {
          await updateTask(task.id, formData);
        } else {
          await createTask(formData);
          formRef.current?.reset();
          setSelectedMetric(null);
          setTitleValue("");
        }
        onDone?.();
        return null;
      } catch {
        return { error: "Failed to save task" };
      }
    },
    null
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300">
          Title
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            name="title"
            required
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            placeholder="What needs to be done?"
            className="block w-full rounded-md bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 shadow-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
          />
          <button
            type="button"
            onClick={handleAutoDetect}
            disabled={isSuggestingMetric || !titleValue.trim()}
            title="Auto-detect metric from title"
            className="flex-shrink-0 rounded-md border border-[#2a2a3c] px-2.5 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors disabled:opacity-40"
          >
            {isSuggestingMetric ? "..." : "\u2728"}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Duration
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {DURATION_PRESETS.map((mins) => (
            <button
              key={mins}
              type="button"
              className="rounded-md border border-[#2a2a3c] px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors"
              onClick={(e) => {
                const input = (e.target as HTMLElement)
                  .closest("div")
                  ?.parentElement?.querySelector(
                    'input[name="durationMinutes"]'
                  ) as HTMLInputElement;
                if (input) input.value = String(mins);
              }}
            >
              {mins < 60 ? `${mins}m` : `${mins / 60}h`}
            </button>
          ))}
        </div>
        <input
          type="number"
          name="durationMinutes"
          required
          min={5}
          max={480}
          defaultValue={task?.durationMinutes || 30}
          className="block w-24 rounded-md bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 shadow-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Deadline
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="date"
              name="deadline"
              defaultValue={
                task?.deadline
                  ? new Date(task.deadline).toISOString().split("T")[0]
                  : ""
              }
              className="block w-full rounded-md bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 shadow-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 [color-scheme:dark]"
            />
            <input
              type="time"
              name="deadlineTime"
              defaultValue={task?.deadlineTime || ""}
              className="block w-[100px] rounded-md bg-[#12121c] border border-[#2a2a3c] px-2 py-2 text-sm text-gray-200 shadow-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 [color-scheme:dark]"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Priority
          </label>
          <select
            name="priority"
            defaultValue={task?.priority || "medium"}
            className="mt-1 block w-full rounded-md bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 shadow-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
          >
            <option value="asap">ASAP</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Energy Type
          </label>
          <select
            name="energyType"
            defaultValue={task?.energyType || "deep"}
            className="mt-1 block w-full rounded-md bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 shadow-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
          >
            <option value="deep">Deep Focus</option>
            <option value="light">Light Work</option>
            <option value="admin">Admin/Meetings</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Preferred Time
          </label>
          <select
            name="preferredTimeWindow"
            defaultValue={task?.preferredTimeWindow || ""}
            className="mt-1 block w-full rounded-md bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 shadow-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
          >
            <option value="">No preference</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300">
          Project
        </label>
        <select
          name="projectId"
          defaultValue={task?.projectId || ""}
          className="mt-1 block w-full rounded-md bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 shadow-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
        >
          <option value="">No project</option>
          {projects.filter((p) => p.status === "active").map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Metric picker */}
      <div>
        <label className="block text-sm font-medium text-gray-300">
          Track Metric
        </label>
        {selectedMetric ? (
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 px-3 py-1 text-sm text-indigo-300">
              <AppleEmoji emoji={selectedMetric.icon} size={14} />
              <span>{selectedMetric.name}</span>
              <span className="text-indigo-400/60">({selectedMetric.unit})</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedMetric(null)}
              className="text-gray-500 hover:text-gray-300 text-xs"
            >
              &#x2715;
            </button>
          </div>
        ) : (
          <MetricPicker
            metrics={metrics}
            value=""
            onChange={(_, m) => { if (m) setSelectedMetric(m); }}
            className="mt-1"
          />
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving..." : task ? "Update Task" : "Add Task"}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-[#2a2a3c] px-4 py-2 text-sm font-medium text-gray-400 shadow-sm hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
