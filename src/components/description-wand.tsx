"use client";

import { useState } from "react";

interface DescriptionWandProps {
  title: string;
  onGenerated: (description: string) => void;
}

const TONES = ["Brief", "Casual", "Professional"] as const;
type Tone = (typeof TONES)[number];

export function DescriptionWand({ title, onGenerated }: DescriptionWandProps) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState<Tone>("Brief");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, goal, context, tone }),
      });
      const data = await res.json();
      if (data.description) {
        onGenerated(data.description);
        setOpen(false);
        setGoal("");
        setContext("");
      } else {
        setError(data.error || "Failed to generate");
      }
    } catch {
      setError("Connection error — try again");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      {/* Wand toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="AI description maker"
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
          open
            ? "bg-violet-600 text-white shadow-sm"
            : "bg-[#2a2a3c] text-violet-400 hover:bg-violet-600/20 hover:text-violet-300"
        }`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          className={generating ? "animate-spin" : ""}
        >
          {/* Wand */}
          <path
            d="M2 14L10 6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Stars */}
          <path
            d="M12 2l.5 1.5L14 4l-1.5.5L12 6l-.5-1.5L10 4l1.5-.5L12 2z"
            fill="currentColor"
          />
          <path
            d="M6 1l.3 1L7.3 2.3l-1 .3L6 3.6l-.3-1L4.7 2.3l1-.3L6 1z"
            fill="currentColor"
            opacity="0.6"
          />
        </svg>
        AI Write
      </button>

      {/* Question panel */}
      {open && (
        <div className="mt-2 rounded-xl border border-violet-500/25 bg-[#13112a] p-4 space-y-3">
          <p className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
            ✨ Tell me about this event
          </p>

          {/* Goal */}
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">
              What&apos;s the goal?
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="e.g. Plan Q2 roadmap, wrap up the client demo…"
              className="w-full rounded-lg bg-[#0e0c1e] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              autoFocus
            />
          </div>

          {/* Context */}
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">
              Any context or details?{" "}
              <span className="text-gray-700">(optional)</span>
            </label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="e.g. Remote, 4 people, bring the slide deck…"
              className="w-full rounded-lg bg-[#0e0c1e] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          {/* Tone */}
          <div>
            <label className="block text-[11px] text-gray-500 mb-1.5">Tone</label>
            <div className="flex gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`rounded-full px-3 py-1 text-xs transition-all ${
                    tone === t
                      ? "bg-violet-600 text-white"
                      : "bg-[#2a2a3c] text-gray-400 hover:text-gray-200 hover:bg-[#3a3a4c]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !goal.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {generating ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Writing…
                </>
              ) : (
                "✨ Generate"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
