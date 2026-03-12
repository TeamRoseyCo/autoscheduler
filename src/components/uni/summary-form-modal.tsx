"use client";

import { useState, useEffect } from "react";

interface SummaryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  courses: any[];
  summary?: any;
}

export function SummaryFormModal({ isOpen, onClose, onSaved, courses, summary }: SummaryFormModalProps) {
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("lecture");
  const [topics, setTopics] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [keyTakeaways, setKeyTakeaways] = useState("");
  const [questions, setQuestions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (summary) {
        setCourseId(summary.courseId || "");
        setDate(summary.date ? new Date(summary.date).toISOString().split("T")[0] : "");
        setType(summary.type || "lecture");
        setTopics(summary.topics || "");
        setSummaryText(summary.summary || "");
        setKeyTakeaways(summary.keyTakeaways || "");
        setQuestions(summary.questions || "");
      } else {
        setCourseId(courses[0]?.id || "");
        setDate(new Date().toISOString().split("T")[0]);
        setType("lecture");
        setTopics("");
        setSummaryText("");
        setKeyTakeaways("");
        setQuestions("");
      }
      setError("");
    }
  }, [isOpen, summary, courses]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!date) {
      setError("Date is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = summary ? `/api/uni/summaries/${summary.id}` : "/api/uni/summaries";
      const res = await fetch(url, {
        method: summary ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: courseId || null,
          date,
          type,
          topics: topics.trim() || null,
          summary: summaryText.trim() || null,
          keyTakeaways: keyTakeaways.trim() || null,
          questions: questions.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
      onClose();
    } catch {
      setError("Failed to save summary");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1e1e30] rounded-xl border border-[#2a2a3c] w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a3c]">
          <h2 className="text-lg font-semibold text-white">{summary ? "Edit Summary" : "New Summary"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>
        )}

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Course</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">No course</option>
                {courses.filter((c: any) => c.status === "active").map((c: any) => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="lecture">Lecture</option>
                <option value="lab">Lab</option>
                <option value="tutorial">Tutorial</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Topics</label>
            <input
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Binary trees, Graph traversal"
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Summary</label>
            <textarea
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              placeholder="What was covered in this class..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Key Takeaways</label>
            <textarea
              value={keyTakeaways}
              onChange={(e) => setKeyTakeaways(e.target.value)}
              placeholder="Main points to remember..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Questions</label>
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="Questions to follow up on..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
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
            {saving ? "Saving..." : summary ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
