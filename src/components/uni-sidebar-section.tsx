"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DashboardIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const CoursesIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 5h14" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const ScheduleIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 6h14M6 2v14M10 2v14M14 2v14M2 10h14M2 14h14" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
  </svg>
);

const ExamsIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 6h6M6 9h6M6 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const GradesIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="10" width="3" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="7.5" y="6" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="13" y="2" width="3" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const NotesIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M4 2h10a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 6h6M6 9h6M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SummariesIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M3 3h12v12H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M6 6h6M6 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3 13l4-4 3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ResourcesIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 4a2 2 0 012-2h4l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const MoodleIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 9a4 4 0 018 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="9" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const AIIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 2l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const SettingsIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.4 3.4l1.4 1.4M13.2 13.2l1.4 1.4M3.4 14.6l1.4-1.4M13.2 4.8l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const UniversityIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 9l7-5 7 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 9v6a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NAV_ITEMS = [
  { href: "/uni", icon: DashboardIcon, label: "Dashboard", exact: true },
  { href: "/uni/courses", icon: CoursesIcon, label: "Courses" },
  { href: "/uni/schedule", icon: ScheduleIcon, label: "Schedule" },
  { href: "/uni/exams", icon: ExamsIcon, label: "Exams" },
  { href: "/uni/grades", icon: GradesIcon, label: "Grades" },
  { href: "/uni/notes", icon: NotesIcon, label: "Notes" },
  { href: "/uni/summaries", icon: SummariesIcon, label: "Summaries" },
  { href: "/uni/resources", icon: ResourcesIcon, label: "Resources" },
  { href: "/uni/moodle", icon: MoodleIcon, label: "Moodle" },
  { href: "/uni/ai", icon: AIIcon, label: "AI Assistant" },
  { href: "/uni/settings", icon: SettingsIcon, label: "Settings", exact: true },
];

function UniversitySidebarLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-[#2a2a40] text-white"
          : "text-gray-400 hover:bg-[#1e1e30] hover:text-gray-200"
      }`}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center opacity-70">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function UniSidebarSection({ collapsed }: { collapsed?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/uni/settings")
      .then((res) => res.json())
      .then((data) => setEnabled(data?.enabled || false))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  if (collapsed) {
    return (
      <div className="flex flex-col gap-1">
        <UniversitySidebarLink
          href="/uni"
          icon={UniversityIcon}
          label="University"
          active={pathname.startsWith("/uni")}
        />
      </div>
    );
  }

  return (
    <div className="pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 w-full text-left transition-colors group"
      >
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center opacity-70 text-gray-600 group-hover:text-gray-400">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path
              d="M3 2l6 4-6 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
          UNIVERSITY
        </span>
      </button>

      {expanded && (
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <UniversitySidebarLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={
                item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
