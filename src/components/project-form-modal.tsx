"use client";

import { useState, useEffect } from "react";
import { createProject, updateProject } from "@/lib/actions/projects";
import type { ProjectColor } from "@/types";

interface EditProject {
  id: string;
  name: string;
  description: string | null;
  color: string;
  deadline: string | Date | null;
}

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  editProject?: EditProject | null;
}

const PROJECT_COLORS: { value: ProjectColor; label: string; dot: string }[] = [
  { value: "indigo", label: "Indigo", dot: "bg-indigo-400" },
  { value: "emerald", label: "Emerald", dot: "bg-emerald-400" },
  { value: "amber", label: "Amber", dot: "bg-amber-400" },
  { value: "rose", label: "Rose", dot: "bg-rose-400" },
  { value: "cyan", label: "Cyan", dot: "bg-cyan-400" },
  { value: "violet", label: "Violet", dot: "bg-violet-400" },
  { value: "orange", label: "Orange", dot: "bg-orange-400" },
];

function formatDeadline(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ProjectFormModal({ isOpen, onClose, onCreated, editProject }: ProjectFormModalProps) {
  const isEditing = !!editProject;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>("indigo");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (isOpen && editProject) {
      setName(editProject.name);
      setDescription(editProject.description || "");
      setColor(editProject.color);
      setDeadline(formatDeadline(editProject.deadline));
      setError(null);
    } else if (isOpen) {
      setName("");
      setDescription("");
      setColor("indigo");
      setDeadline("");
      setError(null);
    }
  }, [isOpen, editProject]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("description", description);
      formData.set("color", color);
      formData.set("deadline", deadline);

      if (isEditing) {
        await updateProject(editProject!.id, formData);
      } else {
        await createProject(formData);
      }
      onCreated();
      onClose();
    } catch {
      setError(isEditing ? "Failed to update project" : "Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">
            {isEditing ? "Edit Project" : "New Project"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Website Redesign"
              className="w-full rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description..."
              className="w-full rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Color</label>
            <div className="flex gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full ${c.dot} transition-all ${
                    color === c.value ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1e30]" : ""
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none [color-scheme:dark]"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {saving ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Project")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#2a2a3c] px-4 py-2 text-sm font-medium text-gray-300 hover:bg-[#3a3a4c] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
