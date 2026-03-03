"use client";

import { useState, useEffect } from "react";

interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

interface SemesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  semesters: Semester[];
}

export function SemesterModal({ isOpen, onClose, onSaved, semesters }: SemesterModalProps) {
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editItem, setEditItem] = useState<Semester | null>(null);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setMode("list");
      setEditItem(null);
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const openForm = (semester?: Semester) => {
    if (semester) {
      setEditItem(semester);
      setName(semester.name);
      setStartDate(semester.startDate.split("T")[0]);
      setEndDate(semester.endDate.split("T")[0]);
      setIsCurrent(semester.isCurrent);
    } else {
      setEditItem(null);
      setName("");
      setStartDate("");
      setEndDate("");
      setIsCurrent(false);
    }
    setError("");
    setMode("form");
  };

  const handleSave = async () => {
    if (!name.trim() || !startDate || !endDate) {
      setError("Name, start date, and end date are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = editItem ? `/api/uni/semesters/${editItem.id}` : "/api/uni/semesters";
      const res = await fetch(url, {
        method: editItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), startDate, endDate, isCurrent }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
      setMode("list");
    } catch {
      setError("Failed to save semester");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this semester? All associated courses will be orphaned.")) return;
    try {
      await fetch(`/api/uni/semesters/${id}`, { method: "DELETE" });
      onSaved();
    } catch {
      setError("Failed to delete");
    }
  };

  const handleSetCurrent = async (id: string) => {
    try {
      await fetch(`/api/uni/semesters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCurrent: true }),
      });
      onSaved();
    } catch {
      setError("Failed to update");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1e1e30] rounded-xl border border-[#2a2a3c] w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a3c]">
          <h2 className="text-lg font-semibold text-white">
            {mode === "list" ? "Manage Semesters" : editItem ? "Edit Semester" : "New Semester"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>
        )}

        {mode === "list" ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {semesters.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No semesters yet</p>
            ) : (
              semesters.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{s.name}</span>
                      {s.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-400">CURRENT</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!s.isCurrent && (
                      <button
                        onClick={() => handleSetCurrent(s.id)}
                        className="px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 rounded"
                        title="Set as current"
                      >
                        Set Current
                      </button>
                    )}
                    <button
                      onClick={() => openForm(s)}
                      className="px-2 py-1 text-xs text-gray-400 hover:bg-[#2a2a3c] rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Semester Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spring 2026"
                className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isCurrent}
                onChange={(e) => setIsCurrent(e.target.checked)}
                className="rounded bg-[#12121c] border-[#2a2a3c]"
              />
              Set as current semester
            </label>
          </div>
        )}

        <div className="flex items-center justify-between p-4 border-t border-[#2a2a3c]">
          {mode === "list" ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Close</button>
              <button
                onClick={() => openForm()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Add Semester
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setMode("list")} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Back</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving..." : editItem ? "Update" : "Create"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
