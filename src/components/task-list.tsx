"use client";

import { useState } from "react";
import { TaskCard } from "@/components/task-card";
import { TaskForm } from "@/components/task-form";
import type { Task } from "@/generated/prisma/client";

export function TaskList({
  activeTasks,
  completedTasks,
}: {
  activeTasks: Task[];
  completedTasks: Task[];
}) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [showForm, setShowForm] = useState(false);

  const tasks = tab === "active" ? activeTasks : completedTasks;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-[#12121c] p-1 border border-[#2a2a3c]">
          <button
            onClick={() => setTab("active")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "active"
                ? "bg-[#2a2a3c] text-gray-100 shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Active ({activeTasks.length})
          </button>
          <button
            onClick={() => setTab("completed")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "completed"
                ? "bg-[#2a2a3c] text-gray-100 shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Done ({completedTasks.length})
          </button>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Task"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-[#2a2a3c] bg-[#1e1e30] p-4">
          <TaskForm onDone={() => setShowForm(false)} />
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#2a2a3c] p-8 text-center text-sm text-gray-500">
          {tab === "active"
            ? "No active tasks. Add one to get started!"
            : "No completed tasks yet."}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
