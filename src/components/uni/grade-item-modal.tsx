"use client";

import { useState, useEffect } from "react";

interface GradeItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  courses: any[];
  grade?: any;
}

export function GradeItemModal({ isOpen, onClose, onSaved, courses, grade }: GradeItemModalProps) {
  const [courseId, setCourseId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("homework");
  const [weight, setWeight] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [score, setScore] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (grade) {
        setCourseId(grade.courseId || "");
        setName(grade.name || "");
        setCategory(grade.category || "homework");
        setWeight(grade.weight?.toString() || "");
        setMaxScore(grade.maxScore?.toString() || "100");
        setScore(grade.score?.toString() || "");
        setDate(grade.date ? new Date(grade.date).toISOString().split("T")[0] : "");
      } else {
        setCourseId(courses[0]?.id || "");
        setName("");
        setCategory("homework");
        setWeight("");
        setMaxScore("100");
        setScore("");
        setDate(new Date().toISOString().split("T")[0]);
      }
      setError("");
    }
  }, [isOpen, grade, courses]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim() || !maxScore) {
      setError("Name and max score are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = grade ? `/api/uni/grades/${grade.id}` : "/api/uni/grades";
      const res = await fetch(url, {
        method: grade ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: courseId || null,
          name: name.trim(),
          category,
          weight: weight ? parseFloat(weight) : null,
          maxScore: parseFloat(maxScore),
          score: score ? parseFloat(score) : 0,
          date: date || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
      onClose();
    } catch {
      setError("Failed to save grade");
    } finally {
      setSaving(false);
    }
  };

  const pct = score && maxScore ? ((parseFloat(score) / parseFloat(maxScore)) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1e1e30] rounded-xl border border-[#2a2a3c] w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a3c]">
          <h2 className="text-lg font-semibold text-white">{grade ? "Edit Grade" : "New Grade"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>
        )}

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Course</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">No course</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Homework 3"
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="homework">Homework</option>
                <option value="midterm">Midterm</option>
                <option value="final">Final</option>
                <option value="quiz">Quiz</option>
                <option value="project">Project</option>
                <option value="participation">Participation</option>
                <option value="lab">Lab</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Weight %</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="10"
                min="0"
                max="100"
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Score</label>
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="85"
                min="0"
                step="any"
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Score</label>
              <input
                type="number"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                placeholder="100"
                min="0"
                step="any"
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {pct !== null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
              <div className="flex-1 h-2 rounded-full bg-[#2a2a3c] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <span className={`text-sm font-medium ${pct >= 80 ? "text-green-400" : pct >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                {pct.toFixed(1)}%
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#2a2a3c]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : grade ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
