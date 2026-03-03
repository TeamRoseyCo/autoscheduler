"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SummaryFormModal } from "./summary-form-modal";

interface SummariesListProps {
  summaries: any[];
  courses: any[];
}

export function SummariesList({ summaries: initialSummaries, courses }: SummariesListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editSummary, setEditSummary] = useState<any>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return initialSummaries.filter((s: any) => {
      if (courseFilter !== "all" && s.courseId !== courseFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(s.topics || "").toLowerCase().includes(q) &&
          !(s.summary || "").toLowerCase().includes(q) &&
          !(s.keyTakeaways || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [initialSummaries, search, courseFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const s of filtered) {
      const dateKey = new Date(s.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(s);
    }
    return groups;
  }, [filtered]);

  // Auto-expand all dates
  useMemo(() => {
    setExpandedDates(new Set(Object.keys(grouped)));
  }, [grouped]);

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this summary?")) return;
    await fetch(`/api/uni/summaries/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditSummary(null);
    router.refresh();
  };

  const TYPE_COLORS: Record<string, string> = {
    lecture: "bg-blue-500/15 text-blue-400",
    lab: "bg-green-500/15 text-green-400",
    tutorial: "bg-purple-500/15 text-purple-400",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Class Summaries</h1>
        <button
          onClick={() => { setEditSummary(null); setShowModal(true); }}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          + Add Summary
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search summaries..."
          className="flex-1 px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
        />
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-gray-300 text-sm"
        >
          <option value="all">All Courses</option>
          {courses.map((c: any) => (
            <option key={c.id} value={c.id}>{c.code}</option>
          ))}
        </select>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">No summaries found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([dateKey, items]) => (
            <div key={dateKey}>
              <button
                onClick={() => toggleDate(dateKey)}
                className="flex items-center gap-2 mb-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  width="10" height="10" viewBox="0 0 12 12" fill="none"
                  className={`transition-transform ${expandedDates.has(dateKey) ? "rotate-90" : ""}`}
                >
                  <path d="M3 2l6 4-6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-medium">{dateKey}</span>
                <span className="text-gray-600">({items.length})</span>
              </button>

              {expandedDates.has(dateKey) && (
                <div className="space-y-3 ml-4">
                  {items.map((s: any) => (
                    <div key={s.id} className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c] hover:bg-[#1a1a2e] transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {s.course && (
                            <span className="text-sm font-mono text-gray-400">{s.course.code}</span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${TYPE_COLORS[s.type] || "bg-gray-500/15 text-gray-400"}`}>
                            {s.type}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditSummary(s); setShowModal(true); }}
                            className="p-1 text-gray-500 hover:text-white rounded"
                          >
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                              <path d="M10 2l2 2-8 8H2v-2l8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-1 text-gray-500 hover:text-red-400 rounded"
                          >
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                              <path d="M3 4h8M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M4 4l.5 7a1 1 0 001 1h3a1 1 0 001-1L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {s.topics && (
                        <div className="flex gap-1 flex-wrap mb-2">
                          {s.topics.split(",").map((t: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 text-[10px] rounded-full bg-[#2a2a3c] text-gray-400">
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      )}

                      {s.summary && (
                        <p className="text-sm text-gray-300 line-clamp-3 mb-2">{s.summary}</p>
                      )}

                      {s.keyTakeaways && (
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="text-gray-400 font-medium">Key takeaways:</span> {s.keyTakeaways}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <SummaryFormModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditSummary(null); }}
        onSaved={handleSaved}
        courses={courses}
        summary={editSummary}
      />
    </div>
  );
}
