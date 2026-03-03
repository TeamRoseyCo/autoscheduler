"use client";

import { useState } from "react";

export function FinalCalculator() {
  const [currentGrade, setCurrentGrade] = useState("");
  const [targetGrade, setTargetGrade] = useState("");
  const [finalWeight, setFinalWeight] = useState("");
  const [collapsed, setCollapsed] = useState(true);

  const current = parseFloat(currentGrade);
  const target = parseFloat(targetGrade);
  const weight = parseFloat(finalWeight);

  const canCalculate = !isNaN(current) && !isNaN(target) && !isNaN(weight) && weight > 0 && weight <= 100;

  // Required = (Target - Current * (1 - weight/100)) / (weight/100)
  const required = canCalculate
    ? (target - current * (1 - weight / 100)) / (weight / 100)
    : null;

  const isAchievable = required !== null && required <= 100;
  const isImpossible = required !== null && required > 100;
  const resultColor = isAchievable
    ? required! <= 60 ? "text-green-400" : required! <= 80 ? "text-yellow-400" : "text-amber-400"
    : "text-red-400";

  return (
    <div className="rounded-lg bg-[#12121c] border border-[#2a2a3c] overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-[#1a1a2e] transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`transition-transform text-gray-500 ${!collapsed ? "rotate-90" : ""}`}
          >
            <path d="M3 2l6 4-6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-medium text-gray-300">Final Grade Calculator</span>
        </div>
        <span className="text-xs text-gray-500">What do I need on my final?</span>
      </button>

      {!collapsed && (
        <div className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Current Grade %</label>
              <input
                type="number"
                value={currentGrade}
                onChange={(e) => setCurrentGrade(e.target.value)}
                placeholder="85"
                min="0"
                max="100"
                step="any"
                className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Target Grade %</label>
              <input
                type="number"
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
                placeholder="90"
                min="0"
                max="100"
                step="any"
                className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Final Weight %</label>
              <input
                type="number"
                value={finalWeight}
                onChange={(e) => setFinalWeight(e.target.value)}
                placeholder="40"
                min="0"
                max="100"
                step="any"
                className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {canCalculate && required !== null && (
            <div className={`p-3 rounded-lg ${isImpossible ? "bg-red-500/10 border border-red-500/30" : "bg-[#1e1e30] border border-[#2a2a3c]"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  You need on your final:
                </span>
                <span className={`text-xl font-bold ${resultColor}`}>
                  {required.toFixed(1)}%
                </span>
              </div>
              {isImpossible && (
                <p className="text-xs text-red-400 mt-1">
                  This target is not achievable with the given final weight.
                </p>
              )}
              {isAchievable && required! < 0 && (
                <p className="text-xs text-green-400 mt-1">
                  You've already secured this grade!
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
