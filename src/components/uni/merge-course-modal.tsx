"use client";

import { useState, useEffect } from "react";
import { mergeCourses } from "@/lib/actions/uni/courses";

interface MergeCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  sourceCourse: any;
  allCourses: any[];
}

export function MergeCourseModal({ isOpen, onClose, onSaved, sourceCourse, allCourses }: MergeCourseModalProps) {
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const candidates = allCourses.filter((c) => c.id !== sourceCourse?.id);

  useEffect(() => {
    if (isOpen) {
      setTargetId(candidates[0]?.id || "");
      setError("");
    }
  }, [isOpen, sourceCourse]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !sourceCourse) return null;

  const handleMerge = async () => {
    if (!targetId) { setError("Select a target course"); return; }
    setSaving(true);
    setError("");
    try {
      await mergeCourses(sourceCourse.id, targetId);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to merge");
    } finally {
      setSaving(false);
    }
  };

  const targetCourse = allCourses.find((c) => c.id === targetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1e1e30] rounded-xl border border-[#2a2a3c] w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a3c]">
          <h2 className="text-lg font-semibold text-white">Merge Course</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-400">
            All exams, grades, notes, class slots, and resources from{" "}
            <span className="text-white font-medium">{sourceCourse.code} — {sourceCourse.name}</span>{" "}
            will be moved into the selected course, and this course will be deleted.
          </p>

          {candidates.length === 0 ? (
            <p className="text-sm text-red-400">No other courses to merge into.</p>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Merge into</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
          )}

          {targetCourse && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <strong>{sourceCourse.code}</strong> will be permanently deleted after merging.
            </div>
          )}

          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#2a2a3c]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={handleMerge}
            disabled={saving || candidates.length === 0}
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Merging..." : "Merge & Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
