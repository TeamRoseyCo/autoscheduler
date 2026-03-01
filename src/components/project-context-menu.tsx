"use client";

import { useEffect, useRef } from "react";

interface ProjectContextMenuProps {
  x: number;
  y: number;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ProjectContextMenu({ x, y, onEdit, onDelete, onClose }: ProjectContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Clamp position to viewport
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const el = ref.current;
    if (rect.right > window.innerWidth) {
      el.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, []);

  return (
    <div
      ref={ref}
      className="fixed z-[60] min-w-[160px] bg-[#1e1e30] border border-[#2a2a3c] rounded-lg shadow-2xl py-1"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onEdit(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-indigo-400">
          <path d="M10.5 1.5l2 2-8 8H2.5v-2l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Edit Project
      </button>
      <div className="h-px bg-[#2a2a3c] my-1" />
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-[#2a2a3c] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-red-400">
          <path d="M2 4h10M5 4V2.5h4V4M3 4v8a1 1 0 001 1h6a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Delete Project
      </button>
    </div>
  );
}
