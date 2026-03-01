"use client";

import { useActionState, useState } from "react";
import { savePreferences } from "@/lib/actions/preferences";
import type { Preferences } from "@/generated/prisma/client";

interface SavedPlace {
  name: string;
  address: string;
}

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
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(() => {
    try {
      return preferences?.savedPlaces ? JSON.parse(preferences.savedPlaces) : [];
    } catch {
      return [];
    }
  });
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceAddress, setNewPlaceAddress] = useState("");
  const [showAddPlace, setShowAddPlace] = useState(false);

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

        // Inject current saved places JSON
        formData.set("savedPlaces", JSON.stringify(savedPlaces));

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

      {/* AI Configuration */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          AI Configuration
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Provider
          </label>
          <select
            name="aiProvider"
            defaultValue={preferences?.aiProvider || "gemini"}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="gemini">Google Gemini (free tier available)</option>
            <option value="openai">OpenAI</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Gemini: get a free key at{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              aistudio.google.com/apikey
            </a>
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            API Key
          </label>
          <input
            type="password"
            name="openaiApiKey"
            defaultValue={preferences?.openaiApiKey || ""}
            placeholder="AIza... (Gemini) or sk-... (OpenAI)"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Your key is stored in the local database only.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Model
          </label>
          <select
            name="openaiModel"
            defaultValue={preferences?.openaiModel || "gemini-1.5-flash"}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <optgroup label="Google Gemini (free tier)">
              <option value="gemini-1.5-flash">Gemini 1.5 Flash — free, 15 req/min ✓ Recommended</option>
              <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B — free, fastest</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash — free, 15 req/min</option>
            </optgroup>
            <optgroup label="OpenAI">
              <option value="gpt-4o-mini">GPT-4o Mini (fast, cheap)</option>
              <option value="gpt-4o">GPT-4o (more capable)</option>
            </optgroup>
          </select>
        </div>
      </section>

      {/* Maps & Transport */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Maps & Transport</h2>
        <p className="text-sm text-gray-500">
          Used to auto-calculate travel time for event transport buffers.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Google Maps API Key
          </label>
          <input
            type="password"
            name="googleMapsApiKey"
            defaultValue={preferences?.googleMapsApiKey || ""}
            placeholder="AIza..."
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Enable the Distance Matrix API, then{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              create a key →
            </a>{" "}
            Your key is stored locally only.
          </p>
        </div>

        {/* Saved Places */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Saved Places
          </label>
          <div className="space-y-2">
            {savedPlaces.length === 0 && !showAddPlace && (
              <p className="text-sm text-gray-400 italic">No saved places yet.</p>
            )}
            {savedPlaces.map((place, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm font-medium text-gray-700 w-24 flex-shrink-0 truncate">{place.name}</span>
                <span className="text-sm text-gray-500 flex-1 truncate">{place.address}</span>
                <button
                  type="button"
                  onClick={() => setSavedPlaces((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-red-400 hover:text-red-600 text-xs px-1 py-0.5 rounded hover:bg-red-50 transition-colors flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
            {showAddPlace && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newPlaceName}
                  onChange={(e) => setNewPlaceName(e.target.value)}
                  placeholder="Name (e.g. Home)"
                  className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newPlaceAddress}
                  onChange={(e) => setNewPlaceAddress(e.target.value)}
                  placeholder="Full address"
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newPlaceName.trim() && newPlaceAddress.trim()) {
                      setSavedPlaces((prev) => [
                        ...prev,
                        { name: newPlaceName.trim(), address: newPlaceAddress.trim() },
                      ]);
                      setNewPlaceName("");
                      setNewPlaceAddress("");
                      setShowAddPlace(false);
                    }
                  }}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddPlace(false); setNewPlaceName(""); setNewPlaceAddress(""); }}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            {!showAddPlace && (
              <button
                type="button"
                onClick={() => setShowAddPlace(true)}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add place
              </button>
            )}
          </div>
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
