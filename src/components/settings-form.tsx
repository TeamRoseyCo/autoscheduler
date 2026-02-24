"use client";

import { useActionState } from "react";
import { savePreferences } from "@/lib/actions/preferences";
import type { Preferences } from "@/generated/prisma/client";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "UTC",
];

const DAYS = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" },
];

export function SettingsForm({
  preferences,
}: {
  preferences: Preferences | null;
}) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { success?: boolean; error?: string } | null, formData: FormData) => {
      try {
        // Collect checked work days
        const workDays = DAYS.map((d) => d.value)
          .filter((v) => formData.get(`day_${v}`) === "on")
          .join(",");
        formData.set("workDays", workDays);
        // Remove individual day fields
        DAYS.forEach((d) => formData.delete(`day_${d.value}`));

        await savePreferences(formData);
        return { success: true };
      } catch {
        return { error: "Failed to save preferences" };
      }
    },
    null
  );

  const selectedDays = (preferences?.workDays || "1,2,3,4,5").split(",");

  return (
    <form action={formAction} className="space-y-8">
      {state?.success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          Preferences saved successfully!
        </div>
      )}
      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Work Hours */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Work Hours</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Start Time
            </label>
            <input
              type="time"
              name="workStartTime"
              defaultValue={preferences?.workStartTime || "09:00"}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              End Time
            </label>
            <input
              type="time"
              name="workEndTime"
              defaultValue={preferences?.workEndTime || "17:00"}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Work Days
          </label>
          <div className="flex gap-2">
            {DAYS.map((day) => (
              <label
                key={day.value}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-400"
              >
                <input
                  type="checkbox"
                  name={`day_${day.value}`}
                  defaultChecked={selectedDays.includes(day.value)}
                  className="accent-indigo-600"
                />
                {day.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Deep Work Window */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Deep Work Window
        </h2>
        <p className="text-sm text-gray-500">
          AI will prefer scheduling deep-focus tasks during this window.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Start
            </label>
            <input
              type="time"
              name="deepWorkStart"
              defaultValue={preferences?.deepWorkStart || "09:00"}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              End
            </label>
            <input
              type="time"
              name="deepWorkEnd"
              defaultValue={preferences?.deepWorkEnd || "12:00"}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>
      </section>

      {/* Break Duration */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Breaks</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Break between tasks (minutes)
          </label>
          <input
            type="number"
            name="breakMinutes"
            defaultValue={preferences?.breakMinutes || 15}
            min={0}
            max={60}
            className="mt-1 block w-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </section>

      {/* Timezone */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Timezone</h2>
        <select
          name="timezone"
          defaultValue={preferences?.timezone || "America/New_York"}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </section>

      {/* OpenAI */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          OpenAI Configuration
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            API Key
          </label>
          <input
            type="password"
            name="openaiApiKey"
            defaultValue={preferences?.openaiApiKey || ""}
            placeholder="sk-..."
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Your key is stored securely in the local database.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Model
          </label>
          <select
            name="openaiModel"
            defaultValue={preferences?.openaiModel || "gpt-4o-mini"}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="gpt-4o-mini">gpt-4o-mini (fast, cheap)</option>
            <option value="gpt-4o">gpt-4o (more capable)</option>
          </select>
        </div>
      </section>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Saving..." : "Save Preferences"}
      </button>
    </form>
  );
}
