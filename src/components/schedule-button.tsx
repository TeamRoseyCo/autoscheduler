"use client";

import { useState, useTransition } from "react";
import { scheduleTodayAction } from "@/lib/actions/schedule";

export function ScheduleButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    message: string;
    unscheduledDetails?: { title: string; reason: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await scheduleTodayAction();
        setResult(res);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Scheduling failed. Try again."
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Scheduling...
          </>
        ) : (
          "Schedule My Day"
        )}
      </button>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          {result.message}
          {result.unscheduledDetails && result.unscheduledDetails.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.unscheduledDetails.map((item, i) => (
                <li key={i} className="text-xs text-amber-700">
                  &bull; {item.title}: {item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
