"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ProjectTask {
  id: string;
  title: string;
  durationMinutes: number;
  priority: string;
  energyType: string;
  completed: boolean;
  deadline: string | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  deadline: string | null;
  createdAt: string;
  tasks: ProjectTask[];
}

interface ProjectDetailModalProps {
  projectId: string | null;
  onClose: () => void;
  onEdit: (projectId: string) => void;
}

const DOT_COLORS: Record<string, string> = {
  indigo: "bg-indigo-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  gray: "bg-slate-400",
  rose: "bg-rose-400",
  cyan: "bg-cyan-400",
  violet: "bg-violet-400",
  orange: "bg-orange-400",
};

const ENERGY_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  deep: { bg: "bg-indigo-500/20", text: "text-indigo-300", label: "Deep" },
  light: { bg: "bg-emerald-500/20", text: "text-emerald-300", label: "Light" },
  admin: { bg: "bg-amber-500/20", text: "text-amber-300", label: "Admin" },
};

const PRIORITY_DOTS: Record<string, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-emerald-400",
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function ProjectDetailModal({ projectId, onClose, onEdit }: ProjectDetailModalProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    setLoading(true);
    fetch(`/api/projects/${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setProject(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [projectId, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose]
  );

  if (!projectId) return null;

  const completedCount = project?.tasks.filter((t) => t.completed).length ?? 0;
  const taskCount = project?.tasks.length ?? 0;
  const totalMinutes = project?.tasks.reduce((sum, t) => sum + t.durationMinutes, 0) ?? 0;
  const completedMinutes = project?.tasks.filter((t) => t.completed).reduce((sum, t) => sum + t.durationMinutes, 0) ?? 0;
  const progress = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;
  const dotColor = DOT_COLORS[project?.color || "gray"] || DOT_COLORS.gray;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-lg bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
          </div>
        ) : !project ? (
          <div className="p-6 text-center text-gray-500">Project not found</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-4 h-4 rounded-full ${dotColor} flex-shrink-0`} />
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-100 truncate">{project.name}</h2>
                  {project.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{project.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                <button
                  onClick={() => onEdit(project.id)}
                  className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-[#2a2a3c]"
                  title="Edit project"
                >
                  <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                    <path d="M10.5 1.5l2 2-8 8H2.5v-2l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-[#2a2a3c]"
                >
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                    <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{taskCount} task{taskCount !== 1 ? "s" : ""}</span>
                <span>{formatDuration(totalMinutes)} total</span>
                <span>{formatDuration(completedMinutes)} done</span>
                {project.deadline && (
                  <span>Due {new Date(project.deadline).toLocaleDateString()}</span>
                )}
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-[#2a2a3c] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${dotColor}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-600 mt-1">{progress}% complete</p>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {project.tasks.length === 0 ? (
                <p className="text-sm text-gray-600 py-4 text-center">No tasks yet</p>
              ) : (
                <div className="space-y-1">
                  {project.tasks.map((task) => {
                    const energy = ENERGY_BADGES[task.energyType] || ENERGY_BADGES.deep;
                    const priorityDot = PRIORITY_DOTS[task.priority] || PRIORITY_DOTS.medium;
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                          task.completed ? "opacity-50" : "hover:bg-[#2a2a3c]/50"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDot}`} />
                        <span className={`text-sm flex-1 truncate ${task.completed ? "text-gray-600 line-through" : "text-gray-300"}`}>
                          {task.title}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${energy.bg} ${energy.text}`}>
                          {energy.label}
                        </span>
                        <span className="text-[11px] text-gray-600">{formatDuration(task.durationMinutes)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
