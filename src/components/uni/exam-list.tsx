"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExamFormModal } from "./exam-form-modal";

const TYPE_ICONS: Record<string, string> = {
  exam: "📝", assignment: "📋", project: "🔬", quiz: "❓",
};

function getDaysUntil(date: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyColor(days: number): { bg: string; text: string } {
  if (days <= 1) return { bg: "bg-red-500/15", text: "text-red-400" };
  if (days <= 3) return { bg: "bg-amber-500/15", text: "text-amber-400" };
  if (days <= 7) return { bg: "bg-yellow-500/15", text: "text-yellow-400" };
  return { bg: "bg-green-500/15", text: "text-green-400" };
}

interface ExamListProps {
  exams: any[];
  courses: any[];
}

export function ExamList({ exams: initialExams, courses }: ExamListProps) {
  const router = useRouter();
  const [timeFilter, setTimeFilter] = useState("upcoming");
  const [courseFilter, setCourseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editExam, setEditExam] = useState<any>(null);

  const now = new Date();

  const filtered = initialExams.filter((e: any) => {
    const examDate = new Date(e.date);
    if (timeFilter === "upcoming" && (examDate < now || e.completed)) return false;
    if (timeFilter === "past" && examDate >= now && !e.completed) return false;
    if (courseFilter !== "all" && e.courseId !== courseFilter) return false;
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    return true;
  });

  const totalCount = initialExams.length;
  const completedCount = initialExams.filter((e: any) => e.completed).length;
  const upcomingCount = initialExams.filter((e: any) => new Date(e.date) >= now && !e.completed).length;

  const handleToggleComplete = async (exam: any) => {
    await fetch(`/api/uni/exams/${exam.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !exam.completed }),
    });
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this exam? Calendar block and study task will also be removed.")) return;
    await fetch(`/api/uni/exams/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditExam(null);
    router.refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Exams & Assessments</h1>
        <button
          onClick={() => { setEditExam(null); setShowModal(true); }}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          + Add Exam
        </button>
      </div>

      {/* Summary bar */}
      <div className="flex gap-4 mb-6">
        {[
          { label: "Total", value: totalCount, color: "text-gray-300" },
          { label: "Completed", value: completedCount, color: "text-green-400" },
          { label: "Upcoming", value: upcomingCount, color: "text-blue-400" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1">
          {["upcoming", "past", "all"].map((t) => (
            <button
              key={t}
              onClick={() => setTimeFilter(t)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-colors ${
                timeFilter === t ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-[#2a2a3c]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-[#12121c] border border-[#2a2a3c] text-gray-300"
        >
          <option value="all">All Courses</option>
          {courses.map((c: any) => (
            <option key={c.id} value={c.id}>{c.code}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-[#12121c] border border-[#2a2a3c] text-gray-300"
        >
          <option value="all">All Types</option>
          <option value="exam">Exam</option>
          <option value="assignment">Assignment</option>
          <option value="project">Project</option>
          <option value="quiz">Quiz</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">No exams found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((exam: any) => {
            const days = getDaysUntil(exam.date);
            const urgency = getUrgencyColor(days);
            const isPast = days < 0 || exam.completed;

            return (
              <div
                key={exam.id}
                className={`flex items-center gap-4 p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c] transition-colors hover:bg-[#1a1a2e] ${isPast ? "opacity-60" : ""}`}
              >
                <button
                  onClick={() => handleToggleComplete(exam)}
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    exam.completed
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-[#2a2a3c] hover:border-green-500"
                  }`}
                >
                  {exam.completed && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{TYPE_ICONS[exam.type] || "📝"}</span>
                    <span className={`text-white font-medium ${exam.completed ? "line-through text-gray-500" : ""}`}>
                      {exam.title}
                    </span>
                    {exam.course && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#2a2a3c] text-gray-400">
                        {exam.course.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{new Date(exam.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                    {exam.time && <span>{exam.time}</span>}
                    {exam.location && <span>{exam.location}</span>}
                    {exam.weight && <span>{exam.weight}%</span>}
                  </div>
                </div>

                {!isPast && (
                  <div className={`px-3 py-1 rounded-lg text-xs font-medium ${urgency.bg} ${urgency.text}`}>
                    {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditExam(exam); setShowModal(true); }}
                    className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-[#2a2a3c] transition-colors"
                    title="Edit"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M10 2l2 2-8 8H2v-2l8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(exam.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 4h8M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M4 4l.5 7a1 1 0 001 1h3a1 1 0 001-1L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ExamFormModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditExam(null); }}
        onSaved={handleSaved}
        courses={courses}
        exam={editExam}
      />
    </div>
  );
}
