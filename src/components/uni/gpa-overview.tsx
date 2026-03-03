"use client";

import { useState } from "react";

interface GPAOverviewProps {
  semesterGPA: number | null;
  cumulativeGPA?: number | null;
  targetGPA?: number | null;
}

export function GPAOverview({ semesterGPA, cumulativeGPA, targetGPA }: GPAOverviewProps) {
  const [showCumulative, setShowCumulative] = useState(false);

  const gpa = showCumulative ? (cumulativeGPA ?? semesterGPA ?? 0) : (semesterGPA ?? 0);
  const maxGPA = 4.0;
  const pct = Math.min((gpa / maxGPA) * 100, 100);

  // SVG circle parameters
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const gpaColor = gpa >= 3.5 ? "#34d399" : gpa >= 3.0 ? "#60a5fa" : gpa >= 2.5 ? "#fbbf24" : "#f87171";

  return (
    <div className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400">GPA Overview</h3>
        {cumulativeGPA !== undefined && cumulativeGPA !== null && (
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setShowCumulative(false)}
              className={`px-2 py-0.5 rounded ${!showCumulative ? "bg-[#2a2a3c] text-white" : "text-gray-500"}`}
            >
              Semester
            </button>
            <button
              onClick={() => setShowCumulative(true)}
              className={`px-2 py-0.5 rounded ${showCumulative ? "bg-[#2a2a3c] text-white" : "text-gray-500"}`}
            >
              Cumulative
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center">
        <div className="relative">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#2a2a3c"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={gpaColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-700 ease-out"
            />
            {/* Target marker */}
            {targetGPA && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#ffffff20"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={`2 ${circumference - 2}`}
                strokeDashoffset={circumference - (Math.min(targetGPA / maxGPA, 1) * circumference)}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{gpa.toFixed(2)}</span>
            <span className="text-[10px] text-gray-500">/ {maxGPA.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {targetGPA && (
        <div className="text-center mt-2">
          <span className="text-xs text-gray-500">
            Target: <span className="text-gray-400">{targetGPA.toFixed(1)}</span>
            {gpa >= targetGPA ? " ✓" : ` (${(targetGPA - gpa).toFixed(2)} to go)`}
          </span>
        </div>
      )}
    </div>
  );
}
