"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { setTaskStatus, deleteTask } from "@/lib/actions/tasks";
import { TaskForm } from "@/components/task-form";
import { formatDuration, getColorClasses } from "@/lib/utils";
import type { Task, Project } from "@/generated/prisma/client";

type TaskWithProject = Task & {
  project?: Pick<Project, "id" | "name" | "color"> | null;
};

type TaskStatus = "todo" | "in_progress" | "completed" | "cancelled" | "blocked";

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: string; className: string; menuClass: string }> = {
  todo: {
    label: "To Do",
    icon: "○",
    className: "text-gray-400",
    menuClass: "hover:bg-gray-50 text-gray-700",
  },
  in_progress: {
    label: "In Progress",
    icon: "◑",
    className: "text-blue-500",
    menuClass: "hover:bg-blue-50 text-blue-700",
  },
  completed: {
    label: "Completed",
    icon: "✓",
    className: "text-green-500",
    menuClass: "hover:bg-green-50 text-green-700",
  },
  cancelled: {
    label: "Cancelled",
    icon: "✕",
    className: "text-red-400",
    menuClass: "hover:bg-red-50 text-red-600",
  },
  blocked: {
    label: "Blocked",
    icon: "◉",
    className: "text-orange-500",
    menuClass: "hover:bg-orange-50 text-orange-700",
  },
};

const PRIORITY_BADGE: Record<string, string> = {
  asap: "bg-red-100 text-red-700 ring-1 ring-red-400",
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-blue-100 text-blue-700",
};

const PROJECT_DOT: Record<string, string> = {
  indigo: "bg-indigo-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  gray: "bg-slate-400",
  rose: "bg-rose-400",
  cyan: "bg-cyan-400",
  violet: "bg-violet-400",
  orange: "bg-orange-400",
};

function StatusPicker({ currentStatus, taskId }: { currentStatus: TaskStatus; taskId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const cfg = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.todo;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        title={cfg.label}
        className={`text-lg leading-none transition-opacity ${cfg.className} ${isPending ? "opacity-40" : "hover:opacity-70"}`}
      >
        {cfg.icon}
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-20 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => {
            const c = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => {
                  setOpen(false);
                  startTransition(() => setTaskStatus(taskId, s));
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${c.menuClass} ${s === currentStatus ? "font-semibold" : ""}`}
              >
                <span className={c.className}>{c.icon}</span>
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TaskCard({ task }: { task: TaskWithProject }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const status = (task.taskStatus as TaskStatus) ?? "todo";
  const isDone = status === "completed" || status === "cancelled";

  const colors = getColorClasses(
    task.energyType === "deep" ? "indigo" : task.energyType === "light" ? "emerald" : "amber"
  );

  if (editing) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <TaskForm task={task} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className={`rounded-lg border-l-4 ${colors.border} bg-white p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <StatusPicker currentStatus={status} taskId={task.id} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${isDone ? "line-through text-gray-400" : "text-gray-900"}`}>
              {task.title}
            </span>
            {task.priority && (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.medium}`}>
                {task.priority === "asap" ? "ASAP" : task.priority}
              </span>
            )}
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
              {task.energyType}
            </span>
            {task.project && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                <span className={`w-2 h-2 rounded-full ${PROJECT_DOT[task.project.color] || "bg-gray-400"}`} />
                {task.project.name}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <span>{formatDuration(task.durationMinutes)}</span>
            {task.deadline && <span>Due {new Date(task.deadline).toLocaleDateString()}</span>}
            {task.preferredTimeWindow && <span>{task.preferredTimeWindow}</span>}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setEditing(true)}
            className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Edit"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (confirm("Delete this task?")) {
                startTransition(() => deleteTask(task.id));
              }
            }}
            disabled={isPending}
            className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
