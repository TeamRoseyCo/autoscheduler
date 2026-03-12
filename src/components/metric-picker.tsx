"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AppleEmoji } from "@/components/apple-emoji";
import { CATEGORY_LABELS } from "@/lib/preset-metrics";

export interface MetricOption {
  id: string;
  name: string;
  unit: string;
  icon: string;
  category: string;
}

interface MetricPickerProps {
  metrics: MetricOption[];
  value: string;
  onChange: (metricId: string, metric: MetricOption | null) => void;
  placeholder?: string;
  className?: string;
}

export function MetricPicker({
  metrics,
  value,
  onChange,
  placeholder = "No metric",
  className = "",
}: MetricPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearch("");
      updatePosition();
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open, updatePosition]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, updatePosition]);

  const selected = metrics.find((m) => m.id === value);

  // Group by category
  const metricsByCategory = metrics.reduce<Record<string, MetricOption[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  // Filter by search
  const lowerSearch = search.toLowerCase();
  const filteredCategories = Object.entries(metricsByCategory)
    .map(([cat, mets]) => {
      const filtered = lowerSearch
        ? mets.filter(
            (m) =>
              m.name.toLowerCase().includes(lowerSearch) ||
              m.unit.toLowerCase().includes(lowerSearch) ||
              (CATEGORY_LABELS[cat] ?? cat).toLowerCase().includes(lowerSearch)
          )
        : mets;
      return [cat, filtered] as [string, MetricOption[]];
    })
    .filter(([, mets]) => mets.length > 0);

  const maxHeight = typeof window !== "undefined" ? Math.min(400, window.innerHeight - pos.top - 16) : 400;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-1.5 text-sm text-left text-gray-300 hover:border-[#3a3a4c] focus:outline-none focus:border-indigo-500/50 transition-colors"
      >
        {selected ? (
          <>
            <AppleEmoji emoji={selected.icon} size={16} />
            <span className="truncate flex-1">{selected.name}</span>
            <span className="text-gray-500 text-xs">({selected.unit})</span>
          </>
        ) : (
          <span className="text-gray-500 flex-1">{placeholder}</span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`flex-shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight, zIndex: 9999 }}
          className="bg-[#1e1e30] border border-[#2a2a3c] rounded-lg shadow-xl flex flex-col overflow-hidden"
        >
          {/* Search */}
          <div className="p-2 border-b border-[#2a2a3c] flex-shrink-0">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search metrics..."
              className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-md px-2.5 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Options */}
          <div className="overflow-y-auto flex-1">
            {/* No metric option */}
            <button
              type="button"
              onClick={() => {
                onChange("", null);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[#2a2a3c] transition-colors ${
                !value ? "text-indigo-300 bg-indigo-500/10" : "text-gray-400"
              }`}
            >
              {placeholder}
            </button>

            {filteredCategories.map(([cat, mets]) => (
              <div key={cat}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-[#12121c]/50 sticky top-0">
                  {CATEGORY_LABELS[cat] ?? cat}
                </div>
                {mets.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onChange(m.id, m);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#2a2a3c] transition-colors ${
                      value === m.id ? "text-indigo-300 bg-indigo-500/10" : "text-gray-300"
                    }`}
                  >
                    <AppleEmoji emoji={m.icon} size={16} />
                    <span className="flex-1 truncate">{m.name}</span>
                    <span className="text-gray-500 text-xs">({m.unit})</span>
                  </button>
                ))}
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">No metrics found</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
