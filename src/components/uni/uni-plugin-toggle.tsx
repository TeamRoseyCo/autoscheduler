"use client";

import { useState } from "react";
import { toggleUniPlugin } from "@/lib/actions/uni/settings";

interface UniPluginToggleProps {
  initialEnabled: boolean;
  onToggle?: (enabled: boolean) => void;
}

export function UniPluginToggle({
  initialEnabled,
  onToggle,
}: UniPluginToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  async function handleToggle(newValue: boolean) {
    setLoading(true);
    try {
      await toggleUniPlugin(newValue);
      setEnabled(newValue);
      onToggle?.(newValue);
    } catch (error) {
      console.error("Failed to toggle uni plugin:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-[#1e1e30] rounded-lg border border-[#2a2a3c]">
      <div className="flex-1">
        <h3 className="font-semibold text-white mb-1">University Tracker</h3>
        <p className="text-sm text-gray-400">
          Track your courses, exams, and grades
        </p>
      </div>
      <button
        onClick={() => handleToggle(!enabled)}
        disabled={loading}
        className={`relative w-14 h-8 rounded-full transition-colors ${
          enabled ? "bg-blue-600" : "bg-gray-600"
        } disabled:opacity-50`}
      >
        <div
          className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
            enabled ? "translate-x-6" : ""
          }`}
        />
      </button>
    </div>
  );
}
