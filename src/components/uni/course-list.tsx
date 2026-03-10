"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SemesterModal } from "./semester-modal";
import { CourseFormModal } from "./course-form-modal";
import { MergeCourseModal } from "./merge-course-modal";

const COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-500", blue: "bg-blue-500", green: "bg-green-500",
  emerald: "bg-emerald-500", teal: "bg-teal-500", purple: "bg-purple-500",
  pink: "bg-pink-500", rose: "bg-rose-500", amber: "bg-amber-500", orange: "bg-orange-500",
};

const BORDER_COLOR_MAP: Record<string, string> = {
  indigo: "border-l-indigo-500", blue: "border-l-blue-500", green: "border-l-green-500",
  emerald: "border-l-emerald-500", teal: "border-l-teal-500", purple: "border-l-purple-500",
  pink: "border-l-pink-500", rose: "border-l-rose-500", amber: "border-l-amber-500", orange: "border-l-orange-500",
};

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-green-500/15", text: "text-green-400", label: "Active" },
  completed: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Completed" },
  dropped: { bg: "bg-gray-500/15", text: "text-gray-400", label: "Dropped" },
};

interface CourseListProps {
  courses: any[];
  semesters: any[];
}

export function CourseList({ courses: initialCourses, semesters: initialSemesters }: CourseListProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("current");
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [mergeSource, setMergeSource] = useState<any>(null);

  const currentSemester = initialSemesters.find((s: any) => s.isCurrent);
  const filteredCourses = initialCourses.filter((c: any) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (semesterFilter === "current" && currentSemester && c.semesterId !== currentSemester.id) return false;
    if (semesterFilter !== "current" && semesterFilter !== "all" && c.semesterId !== semesterFilter) return false;
    return true;
  });

  const handleSaved = () => {
    router.refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Courses</h1>
          <p className="text-sm text-gray-400 mt-1">{filteredCourses.length} course{filteredCourses.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSemesterModal(true)}
            className="px-4 py-2 text-sm border border-[#2a2a3c] text-gray-300 hover:bg-[#2a2a3c] rounded-lg transition-colors"
          >
            Manage Semesters
          </button>
          <button
            onClick={() => setShowCourseModal(true)}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            + Add Course
          </button>
        </div>
      </div>

      {/* Semester filter tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        <button
          onClick={() => setSemesterFilter("current")}
          className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors ${
            semesterFilter === "current" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-[#2a2a3c]"
          }`}
        >
          Current Semester
        </button>
        <button
          onClick={() => setSemesterFilter("all")}
          className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors ${
            semesterFilter === "all" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-[#2a2a3c]"
          }`}
        >
          All Semesters
        </button>
        {initialSemesters.map((s: any) => (
          <button
            key={s.id}
            onClick={() => setSemesterFilter(s.id)}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors ${
              semesterFilter === s.id ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-[#2a2a3c]"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-6">
        {[
          { key: "all", label: "All" },
          { key: "active", label: "Active" },
          { key: "completed", label: "Completed" },
          { key: "dropped", label: "Dropped" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              statusFilter === tab.key ? "bg-[#2a2a3c] text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredCourses.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg mb-2">No courses found</p>
          <p className="text-gray-600 text-sm">Add your first course to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course: any) => {
            const badge = STATUS_BADGES[course.status] || STATUS_BADGES.active;
            const examsCount = course._count?.exams ?? course.exams?.length ?? 0;
            const notesCount = course._count?.notes ?? course.notes?.length ?? 0;
            const gradesCount = course._count?.gradeItems ?? course.gradeItems?.length ?? 0;
            const resourcesCount = course._count?.resources ?? course.resources?.length ?? 0;

            return (
              <div
                key={course.id}
                onClick={() => router.push(`/uni/courses/${course.id}`)}
                className={`relative p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c] border-l-4 ${BORDER_COLOR_MAP[course.color] || "border-l-indigo-500"} cursor-pointer hover:bg-[#1a1a2e] transition-colors group`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${COLOR_MAP[course.color] || "bg-indigo-500"}`} />
                    <span className="text-xs font-mono text-gray-400">{course.code}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>
                <h3 className="text-white font-medium mb-1 line-clamp-1">{course.name}</h3>
                {course.professor && (
                  <p className="text-xs text-gray-500 mb-1">{course.professor}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-gray-600 mt-3">
                  {course.credits && <span>{course.credits} cr</span>}
                  {course.room && <span>{course.room}</span>}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2 pt-2 border-t border-[#2a2a3c]">
                  <span>{examsCount} exams</span>
                  <span>{gradesCount} grades</span>
                  <span>{notesCount} notes</span>
                  <span>{resourcesCount} resources</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setMergeSource(course); }}
                  className="absolute top-2 right-2 px-2 py-0.5 text-[10px] text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                >
                  Merge
                </button>
              </div>
            );
          })}
        </div>
      )}

      <SemesterModal
        isOpen={showSemesterModal}
        onClose={() => setShowSemesterModal(false)}
        onSaved={handleSaved}
        semesters={initialSemesters}
      />
      <CourseFormModal
        isOpen={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        onSaved={handleSaved}
        semesters={initialSemesters}
      />
      <MergeCourseModal
        isOpen={!!mergeSource}
        onClose={() => setMergeSource(null)}
        onSaved={handleSaved}
        sourceCourse={mergeSource}
        allCourses={initialCourses}
      />
    </div>
  );
}
