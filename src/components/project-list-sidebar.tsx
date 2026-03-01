"use client";

import type { ProjectWithCounts } from "@/lib/actions/projects";

interface ProjectListSidebarProps {
  projects: ProjectWithCounts[];
  onAddClick: () => void;
  onAIClick: () => void;
  onProjectClick?: (projectId: string) => void;
  onProjectContextMenu?: (projectId: string, x: number, y: number) => void;
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

export function ProjectListSidebar({ projects, onAddClick, onAIClick, onProjectClick, onProjectContextMenu }: ProjectListSidebarProps) {
  const activeProjects = projects.filter((p) => p.status === "active");

  return (
    <div className="pt-4 pb-1">
      <div className="flex items-center justify-between px-3 mb-1">
        <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
          Projects
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={onAIClick}
            className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
            title="Generate project with AI"
          >
            AI
          </button>
          <button
            onClick={onAddClick}
            className="text-gray-500 hover:text-gray-300 transition-colors p-0.5"
            title="New project"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {activeProjects.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-gray-600">No projects yet</p>
      ) : (
        <div className="space-y-0.5">
          {activeProjects.map((project) => {
            const progress = project.taskCount > 0
              ? Math.round((project.completedCount / project.taskCount) * 100)
              : 0;
            const dotColor = DOT_COLORS[project.color] || DOT_COLORS.gray;

            return (
              <div
                key={project.id}
                className="px-3 py-1.5 hover:bg-[#1e1e30] rounded-lg transition-colors cursor-pointer"
                onClick={() => onProjectClick?.(project.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onProjectContextMenu?.(project.id, e.clientX, e.clientY);
                }}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />
                  <span className="text-xs text-gray-300 truncate flex-1">{project.name}</span>
                  <span className="text-[10px] text-gray-600">{project.completedCount}/{project.taskCount}</span>
                </div>
                {project.taskCount > 0 && (
                  <div className="mt-1 ml-[18px]">
                    <div className="h-1 bg-[#2a2a3c] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${dotColor}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
