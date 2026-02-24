"use client";

import { useState, useTransition } from "react";
import { toggleTask, deleteTask } from "@/lib/actions/tasks";
import { TaskForm } from "@/components/task-form";
import { formatDuration, getColorClasses } from "@/lib/utils";
import type { Task } from "@/generated/prisma/client";

const priorityBadge: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-blue-100 text-blue-700",
};

export function TaskCard({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const colors = getColorClasses(
    task.energyType === "deep"
      ? "indigo"
      : task.energyType === "light"
      ? "emerald"
      : "amber"
  );

  if (editing) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <TaskForm task={task} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border-l-4 ${colors.border} bg-white p-4 shadow-sm`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => startTransition(() => toggleTask(task.id))}
          className="mt-1 h-4 w-4 rounded accent-indigo-600"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm font-medium ${
                task.completed ? "line-through text-gray-400" : "text-gray-900"
              }`}
            >
              {task.title}
            </span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                priorityBadge[task.priority]
              }`}
            >
              {task.priority}
            </span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
            >
              {task.energyType}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <span>{formatDuration(task.durationMinutes)}</span>
            {task.deadline && (
              <span>
                Due {new Date(task.deadline).toLocaleDateString()}
              </span>
            )}
            {task.preferredTimeWindow && (
              <span>{task.preferredTimeWindow}</span>
            )}
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
