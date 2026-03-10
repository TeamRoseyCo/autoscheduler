"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ProjectListSidebar } from "@/components/project-list-sidebar";
import { UniSidebarSection } from "@/components/uni-sidebar-section";
import type { ProjectWithCounts } from "@/lib/actions/projects";

interface LeftSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onSearchClick?: () => void;
  onHabitsClick?: () => void;
  projects?: ProjectWithCounts[];
  onAddProjectClick?: () => void;
  onAIProjectClick?: () => void;
  onProjectClick?: (projectId: string) => void;
  onProjectContextMenu?: (projectId: string, x: number, y: number) => void;
}

function todayLabel(): string {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

function SidebarLink({
  href,
  icon,
  label,
  active,
  badge,
  collapsed,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: string;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const baseCollapsed = `flex items-center justify-center rounded-lg p-2 transition-colors ${
    active ? "bg-[#2a2a40] text-white" : "text-gray-400 hover:bg-[#1e1e30] hover:text-gray-200"
  }`;
  const baseExpanded = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    active ? "bg-[#2a2a40] text-white" : "text-gray-400 hover:bg-[#1e1e30] hover:text-gray-200"
  }`;

  if (onClick) {
    if (collapsed) {
      return (
        <button onClick={onClick} title={label} className={baseCollapsed + " w-full"}>
          <span className="w-5 h-5 flex items-center justify-center opacity-70">{icon}</span>
        </button>
      );
    }
    return (
      <button onClick={onClick} className={baseExpanded + " w-full text-left"}>
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center opacity-70">{icon}</span>
        <span className="truncate">{label}</span>
        {badge && <span className="ml-auto text-[11px] text-gray-500 truncate">{badge}</span>}
      </button>
    );
  }

  if (collapsed) {
    return (
      <Link href={href} title={label} className={baseCollapsed}>
        <span className="w-5 h-5 flex items-center justify-center opacity-70">{icon}</span>
      </Link>
    );
  }

  return (
    <Link href={href} className={baseExpanded}>
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center opacity-70">{icon}</span>
      <span className="truncate">{label}</span>
      {badge && <span className="ml-auto text-[11px] text-gray-500 truncate">{badge}</span>}
    </Link>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

const CalendarIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="3" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 7h14" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 1v4M12 1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const TasksIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HabitsIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M3 9a6 6 0 1012 0A6 6 0 003 9z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1.5 9H3M15 9h1.5M9 1.5V3M9 15v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const StatsIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="10" width="3" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="7.5" y="6" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="13" y="2" width="3" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const SettingsIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.4 3.4l1.4 1.4M13.2 13.2l1.4 1.4M3.4 14.6l1.4-1.4M13.2 4.8l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function LeftSidebar({
  collapsed = false,
  onToggle,
  onSearchClick,
  onHabitsClick,
  projects = [],
  onAddProjectClick,
  onAIProjectClick,
  onProjectClick,
  onProjectContextMenu,
}: LeftSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!session) return null;

  // Collapsed narrow sidebar
  if (collapsed) {
    return (
      <aside className="w-14 flex-shrink-0 bg-[#16161f] border-r border-[#2a2a3c] flex flex-col h-full select-none transition-all duration-200">
        <div className="flex items-center justify-center px-1 py-3 border-b border-[#2a2a3c]">
          <button
            onClick={onToggle}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
            title="Expand sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          <SidebarLink href="/" icon={CalendarIcon} label="Calendar" active={pathname === "/"} collapsed />
          <SidebarLink href="/tasks" icon={TasksIcon} label="Tasks" active={pathname === "/tasks"} collapsed />
          <SidebarLink href="/habits" icon={HabitsIcon} label="Habits" active={false} collapsed onClick={onHabitsClick} />
          <SidebarLink href="/stats" icon={StatsIcon} label="Stats" active={pathname === "/stats"} collapsed />
          <SidebarLink href="/settings" icon={SettingsIcon} label="Settings" active={pathname === "/settings"} collapsed />
          <UniSidebarSection collapsed />
        </nav>

        <div className="border-t border-[#2a2a3c] px-2 py-2">
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="flex items-center justify-center w-full p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-[#1e1e30] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H4a2 2 0 00-2 2v8a2 2 0 002 2h2M11 11l3-3-3-3M6 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </aside>
    );
  }

  // Expanded full sidebar
  return (
    <aside className="w-60 flex-shrink-0 bg-[#16161f] border-r border-[#2a2a3c] flex flex-col h-full select-none transition-all duration-200">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#2a2a3c]">
        {session.user?.image ? (
          <img
            src={session.user.image}
            alt=""
            className="h-7 w-7 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            A
          </div>
        )}
        <span className="text-sm font-semibold text-gray-100 truncate">
          {session.user?.name || "AutoScheduler"}
        </span>
        <button
          onClick={onToggle}
          className="ml-auto text-gray-500 hover:text-gray-300 transition-colors p-1"
          title="Collapse sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 4L10 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <button
          onClick={onSearchClick}
          className="flex items-center gap-2 rounded-lg bg-[#1e1e30] px-3 py-2 text-sm text-gray-500 hover:bg-[#252540] cursor-pointer transition-colors w-full text-left"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Search</span>
          <span className="ml-auto text-[10px] text-gray-600 bg-[#2a2a3c] px-1.5 py-0.5 rounded">Ctrl /</span>
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        <SidebarLink
          href="/"
          icon={CalendarIcon}
          label="Calendar"
          active={pathname === "/"}
          badge={todayLabel()}
        />

        <SidebarLink
          href="/tasks"
          icon={TasksIcon}
          label="Tasks"
          active={pathname === "/tasks"}
        />

        <SidebarLink
          href="/habits"
          icon={HabitsIcon}
          label="Habits"
          active={false}
          onClick={onHabitsClick}
        />

        <SidebarLink
          href="/stats"
          icon={StatsIcon}
          label="Stats"
          active={pathname === "/stats"}
        />

        <SidebarLink
          href="/settings"
          icon={SettingsIcon}
          label="Settings"
          active={pathname === "/settings"}
        />

        {/* Projects section */}
        <ProjectListSidebar
          projects={projects}
          onAddClick={onAddProjectClick || (() => {})}
          onAIClick={onAIProjectClick || (() => {})}
          onProjectClick={onProjectClick}
          onProjectContextMenu={onProjectContextMenu}
        />

        {/* University section */}
        <UniSidebarSection />

        {/* Legend section */}
        <div className="pt-4 pb-1">
          <p className="px-3 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
            Color Legend
          </p>
        </div>
        <LegendDot color="bg-indigo-400" label="Deep Focus" />
        <LegendDot color="bg-emerald-400" label="Light Work" />
        <LegendDot color="bg-amber-400" label="Admin" />
        <LegendDot color="bg-slate-400" label="External Events" />
      </nav>

      {/* Footer */}
      <div className="border-t border-[#2a2a3c] px-3 py-2">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-[#1e1e30] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H4a2 2 0 00-2 2v8a2 2 0 002 2h2M11 11l3-3-3-3M6 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
