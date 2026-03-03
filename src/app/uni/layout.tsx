"use client";

import { useState } from "react";
import Link from "next/link";
import { LeftSidebar } from "@/components/left-sidebar";

export default function UniLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#12121c]">
      <LeftSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Back to Calendar bar */}
        <div className="flex-shrink-0 border-b border-[#2a2a3c] bg-[#16161f] px-4 py-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg px-2 py-1.5 hover:bg-[#1e1e30]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 12L6 8l4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to Calendar
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
