"use client";

import { useState, useEffect } from "react";

interface ExamFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  courses: any[];
  exam?: any;
}

export function ExamFormModal({ isOpen, onClose, onSaved, courses, exam }: ExamFormModalProps) {
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("exam");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (exam) {
        setCourseId(exam.courseId || "");
        setTitle(exam.title || "");
        setType(exam.type || "exam");
        setDate(exam.date ? new Date(exam.date).toISOString().split("T")[0] : "");
        setTime(exam.time || "");
        setLocation(exam.location || "");
        setWeight(exam.weight?.toString() || "");
        setNotes(exam.notes || "");
      } else {
        setCourseId(courses[0]?.id || "");
        setTitle("");
        setType("exam");
        setDate("");
        setTime("");
        setLocation("");
        setWeight("");
        setNotes("");
      }
      setError("");
    }
  }, [isOpen, exam, courses]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!courseId || !title.trim() || !date) {
      setError("Course, title, and date are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = exam ? `/api/uni/exams/${exam.id}` : "/api/uni/exams";
      const res = await fetch(url, {
        method: exam ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          title: title.trim(),
          type,
          date,
          time: time || null,
          location: location.trim() || null,
          weight: weight ? parseFloat(weight) : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
      onClose();
    } catch {
      setError("Failed to save exam");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1e1e30] rounded-xl border border-[#2a2a3c] w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a3c]">
          <h2 className="text-lg font-semibold text-white">{exam ? "Edit Exam" : "New Exam"}</h2>
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
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Midterm Exam"
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="exam">Exam</option>
                <option value="assignment">Assignment</option>
                <option value="project">Project</option>
                <option value="quiz">Quiz</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Weight %</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="25"
                min="0"
                max="100"
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
              <label className="block text-sm text-gray-400 mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Room 301"
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Study topics, allowed materials..."
              rows={3}
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
            {saving ? "Saving..." : exam ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
