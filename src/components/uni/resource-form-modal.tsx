"use client";

import { useState, useEffect } from "react";

interface ResourceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  courses: any[];
  resource?: any;
}

export function ResourceFormModal({ isOpen, onClose, onSaved, courses, resource }: ResourceFormModalProps) {
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("link");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [starred, setStarred] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (resource) {
        setCourseId(resource.courseId || "");
        setTitle(resource.title || "");
        setUrl(resource.url || "");
        setType(resource.type || "link");
        setCategory(resource.category || "");
        setNotes(resource.notes || "");
        setStarred(resource.starred || false);
      } else {
        setCourseId(courses[0]?.id || "");
        setTitle("");
        setUrl("");
        setType("link");
        setCategory("");
        setNotes("");
        setStarred(false);
      }
      setError("");
    }
  }, [isOpen, resource, courses]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const apiUrl = resource ? `/api/uni/resources/${resource.id}` : "/api/uni/resources";
      const res = await fetch(apiUrl, {
        method: resource ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: courseId || null,
          title: title.trim(),
          url: url.trim() || null,
          type,
          category: category.trim() || null,
          notes: notes.trim() || null,
          starred,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
      onClose();
    } catch {
      setError("Failed to save resource");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1e1e30] rounded-xl border border-[#2a2a3c] w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a3c]">
          <h2 className="text-lg font-semibold text-white">{resource ? "Edit Resource" : "New Resource"}</h2>
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
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lecture slides - Week 5"
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
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
                <option value="link">Link</option>
                <option value="file">File</option>
                <option value="textbook">Textbook</option>
                <option value="video">Video</option>
                <option value="website">Website</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Slides, Notes..."
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Description or notes..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={starred}
              onChange={(e) => setStarred(e.target.checked)}
              className="rounded bg-[#12121c] border-[#2a2a3c]"
            />
            Star this resource
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#2a2a3c]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : resource ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
