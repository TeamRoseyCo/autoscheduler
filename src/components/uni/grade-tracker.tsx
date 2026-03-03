"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GradeItemModal } from "./grade-item-modal";

function convertPercentageToGPA(pct: number): number {
  if (pct >= 93) return 4.0;
  if (pct >= 90) return 3.7;
  if (pct >= 87) return 3.3;
  if (pct >= 83) return 3.0;
  if (pct >= 80) return 2.7;
  if (pct >= 77) return 2.3;
  if (pct >= 73) return 2.0;
  if (pct >= 70) return 1.7;
  if (pct >= 67) return 1.3;
  if (pct >= 63) return 1.0;
  if (pct >= 60) return 0.7;
  return 0.0;
}

function getLetterGrade(pct: number): string {
  if (pct >= 93) return "A";
  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+";
  if (pct >= 83) return "B";
  if (pct >= 80) return "B-";
  if (pct >= 77) return "C+";
  if (pct >= 73) return "C";
  if (pct >= 70) return "C-";
  if (pct >= 67) return "D+";
  if (pct >= 63) return "D";
  if (pct >= 60) return "D-";
  return "F";
}

interface GradeTrackerProps {
  grades: any[];
  courses: any[];
}

export function GradeTracker({ grades: initialGrades, courses }: GradeTrackerProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editGrade, setEditGrade] = useState<any>(null);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  const groupedByCourse = useMemo(() => {
    const groups: Record<string, { course: any; items: any[]; weightedPct: number; totalWeight: number }> = {};
    for (const g of initialGrades) {
      const key = g.courseId || "unassigned";
      if (!groups[key]) {
        groups[key] = {
          course: g.course || { id: "unassigned", code: "N/A", name: "Unassigned" },
          items: [],
          weightedPct: 0,
          totalWeight: 0,
        };
      }
      groups[key].items.push(g);
    }
    for (const key of Object.keys(groups)) {
      const group = groups[key];
      let weightedSum = 0;
      let totalWeight = 0;
      for (const item of group.items) {
        if (item.score != null && item.maxScore > 0) {
          const pct = (item.score / item.maxScore) * 100;
          const w = item.weight || 1;
          weightedSum += pct * w;
          totalWeight += w;
        }
      }
      group.weightedPct = totalWeight > 0 ? weightedSum / totalWeight : 0;
      group.totalWeight = totalWeight;
    }
    return groups;
  }, [initialGrades]);

  const semesterGPA = useMemo(() => {
    const courseGPAs: number[] = [];
    for (const group of Object.values(groupedByCourse)) {
      if (group.totalWeight > 0 && group.course.id !== "unassigned") {
        courseGPAs.push(convertPercentageToGPA(group.weightedPct));
      }
    }
    return courseGPAs.length > 0 ? courseGPAs.reduce((a, b) => a + b, 0) / courseGPAs.length : 0;
  }, [groupedByCourse]);

  const toggleCourse = (id: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this grade?")) return;
    await fetch(`/api/uni/grades/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditGrade(null);
    router.refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Grades</h1>
        <button
          onClick={() => { setEditGrade(null); setShowModal(true); }}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          + Add Grade
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
          <div className="text-xs text-gray-500 mb-1">Semester GPA</div>
          <div className="text-2xl font-bold text-white">{semesterGPA.toFixed(2)}</div>
        </div>
        <div className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
          <div className="text-xs text-gray-500 mb-1">Courses Tracked</div>
          <div className="text-2xl font-bold text-white">
            {Object.keys(groupedByCourse).filter((k) => k !== "unassigned").length}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
          <div className="text-xs text-gray-500 mb-1">Total Grades</div>
          <div className="text-2xl font-bold text-white">{initialGrades.length}</div>
        </div>
      </div>

      {/* Course cards */}
      {Object.entries(groupedByCourse).length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">No grades yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByCourse).map(([key, group]) => {
            const isExpanded = expandedCourses.has(key);
            const pct = group.weightedPct;
            const letter = getLetterGrade(pct);
            const pctColor = pct >= 80 ? "text-green-400" : pct >= 60 ? "text-yellow-400" : "text-red-400";
            const barColor = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";

            return (
              <div key={key} className="rounded-lg bg-[#12121c] border border-[#2a2a3c] overflow-hidden">
                <button
                  onClick={() => toggleCourse(key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#1a1a2e] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      width="12" height="12" viewBox="0 0 12 12" fill="none"
                      className={`transition-transform text-gray-500 ${isExpanded ? "rotate-90" : ""}`}
                    >
                      <path d="M3 2l6 4-6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="font-mono text-sm text-gray-400">{group.course.code}</span>
                    <span className="text-white font-medium">{group.course.name}</span>
                    <span className="text-xs text-gray-500">({group.items.length} items)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 rounded-full bg-[#2a2a3c] overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <span className={`font-bold ${pctColor}`}>{pct.toFixed(1)}%</span>
                    <span className={`text-sm font-semibold ${pctColor}`}>{letter}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#2a2a3c]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs">
                          <th className="text-left p-3 font-normal">Name</th>
                          <th className="text-left p-3 font-normal">Category</th>
                          <th className="text-center p-3 font-normal">Score</th>
                          <th className="text-center p-3 font-normal">%</th>
                          <th className="text-center p-3 font-normal">Weight</th>
                          <th className="text-right p-3 font-normal">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item: any) => {
                          const itemPct = item.maxScore > 0 ? (item.score / item.maxScore) * 100 : 0;
                          const itemColor = itemPct >= 80 ? "text-green-400" : itemPct >= 60 ? "text-yellow-400" : "text-red-400";
                          return (
                            <tr key={item.id} className="border-t border-[#2a2a3c]/50 hover:bg-[#1a1a2e]">
                              <td className="p-3 text-white">{item.name}</td>
                              <td className="p-3 text-gray-400 capitalize">{item.category}</td>
                              <td className="p-3 text-center text-gray-300">{item.score}/{item.maxScore}</td>
                              <td className={`p-3 text-center font-medium ${itemColor}`}>{itemPct.toFixed(1)}%</td>
                              <td className="p-3 text-center text-gray-500">{item.weight ? `${item.weight}%` : "-"}</td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => { setEditGrade(item); setShowModal(true); }}
                                  className="p-1 text-gray-500 hover:text-white rounded"
                                >
                                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                                    <path d="M10 2l2 2-8 8H2v-2l8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1 text-gray-500 hover:text-red-400 rounded ml-1"
                                >
                                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                                    <path d="M3 4h8M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M4 4l.5 7a1 1 0 001 1h3a1 1 0 001-1L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <GradeItemModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditGrade(null); }}
        onSaved={handleSaved}
        courses={courses}
        grade={editGrade}
      />
    </div>
  );
}
