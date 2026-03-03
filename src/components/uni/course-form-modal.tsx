"use client";

import { useState, useEffect } from "react";

const COURSE_COLORS = [
  "indigo", "blue", "green", "emerald", "teal",
  "purple", "pink", "rose", "amber", "orange",
];

const COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-500", blue: "bg-blue-500", green: "bg-green-500",
  emerald: "bg-emerald-500", teal: "bg-teal-500", purple: "bg-purple-500",
  pink: "bg-pink-500", rose: "bg-rose-500", amber: "bg-amber-500", orange: "bg-orange-500",
};

interface CourseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  semesters: any[];
  course?: any;
}

export function CourseFormModal({ isOpen, onClose, onSaved, semesters, course }: CourseFormModalProps) {
  const [semesterId, setSemesterId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [professor, setProfessor] = useState("");
  const [room, setRoom] = useState("");
  const [credits, setCredits] = useState("");
  const [color, setColor] = useState("indigo");
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (course) {
        setSemesterId(course.semesterId || "");
        setCode(course.code || "");
        setName(course.name || "");
        setProfessor(course.professor || "");
        setRoom(course.room || "");
        setCredits(course.credits?.toString() || "");
        setColor(course.color || "indigo");
        setStatus(course.status || "active");
      } else {
        setSemesterId(semesters.find((s: any) => s.isCurrent)?.id || semesters[0]?.id || "");
        setCode("");
        setName("");
        setProfessor("");
        setRoom("");
        setCredits("");
        setColor("indigo");
        setStatus("active");
      }
      setError("");
    }
  }, [isOpen, course, semesters]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!code.trim() || !name.trim() || !semesterId) {
      setError("Code, name, and semester are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = course ? `/api/uni/courses/${course.id}` : "/api/uni/courses";
      const res = await fetch(url, {
        method: course ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId,
          code: code.trim(),
          name: name.trim(),
          professor: professor.trim() || null,
          room: room.trim() || null,
          credits: credits ? parseInt(credits) : null,
          color,
          status,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
      onClose();
    } catch {
      setError("Failed to save course");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1e1e30] rounded-xl border border-[#2a2a3c] w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a3c]">
          <h2 className="text-lg font-semibold text-white">{course ? "Edit Course" : "New Course"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>
        )}

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Semester</label>
            <select
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {semesters.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Course Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CS101"
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Credits</label>
              <input
                type="number"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                placeholder="3"
                min="0"
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Course Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Introduction to Computer Science"
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Professor</label>
            <input
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Dr. Smith"
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Room</label>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Room 204"
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COURSE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full ${COLOR_MAP[c]} transition-all ${
                    color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1e30] scale-110" : "opacity-60 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#2a2a3c]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : course ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
