"use client";

import { useActionState, useRef } from "react";
import { createTask, updateTask } from "@/lib/actions/tasks";
import type { Task } from "@/generated/prisma/client";

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export function TaskForm({
  task,
  onDone,
}: {
  task?: Task;
  onDone?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      try {
        if (task) {
          await updateTask(task.id, formData);
        } else {
          await createTask(formData);
          formRef.current?.reset();
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
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          name="title"
          required
          defaultValue={task?.title || ""}
          placeholder="What needs to be done?"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Duration
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {DURATION_PRESETS.map((mins) => (
            <button
              key={mins}
              type="button"
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
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
          className="block w-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Deadline
          </label>
          <input
            type="date"
            name="deadline"
            defaultValue={
              task?.deadline
                ? new Date(task.deadline).toISOString().split("T")[0]
                : ""
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Priority
          </label>
          <select
            name="priority"
            defaultValue={task?.priority || "medium"}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Energy Type
          </label>
          <select
            name="energyType"
            defaultValue={task?.energyType || "deep"}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="deep">Deep Focus</option>
            <option value="light">Light Work</option>
            <option value="admin">Admin/Meetings</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Preferred Time
          </label>
          <select
            name="preferredTimeWindow"
            defaultValue={task?.preferredTimeWindow || ""}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">No preference</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving..." : task ? "Update Task" : "Add Task"}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
