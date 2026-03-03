"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GPAOverview } from "./gpa-overview";
import { ExamFormModal } from "./exam-form-modal";
import { GradeItemModal } from "./grade-item-modal";
import { SummaryFormModal } from "./summary-form-modal";

interface DashboardData {
  currentSemester: any;
  upcomingExams: any[];
  todaysClasses: any[];
  courses: any[];
  semesterGPA: number | null;
  recentGrades?: any[];
  cumulativeGPA?: number | null;
  totalCredits?: number;
  settings?: any;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getSemesterProgress(semester: any): { week: number; totalWeeks: number; pct: number; daysLeft: number } | null {
  if (!semester) return null;
  const start = new Date(semester.startDate);
  const end = new Date(semester.endDate);
  const now = new Date();
  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = now.getTime() - start.getTime();
  const totalWeeks = Math.max(1, Math.ceil(totalMs / (7 * 24 * 60 * 60 * 1000)));
  const week = Math.max(1, Math.min(totalWeeks, Math.ceil(elapsedMs / (7 * 24 * 60 * 60 * 1000))));
  const pct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  return { week, totalWeeks, pct, daysLeft };
}

function getDaysUntil(date: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyColor(days: number): string {
  if (days <= 1) return "bg-red-500/15 text-red-400";
  if (days <= 3) return "bg-amber-500/15 text-amber-400";
  if (days <= 7) return "bg-yellow-500/15 text-yellow-400";
  return "bg-green-500/15 text-green-400";
}

function getClassStatus(slot: any): "past" | "now" | "next" | "future" {
  const now = new Date();
  const hh = now.getHours();
  const mm = now.getMinutes();
  const currentMinutes = hh * 60 + mm;
  const [sh, sm] = slot.startTime.split(":").map(Number);
  const [eh, em] = slot.endTime.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (currentMinutes >= startMin && currentMinutes < endMin) return "now";
  if (currentMinutes < startMin) return "future";
  return "past";
}

export function UniDashboard({ data }: { data: DashboardData | null }) {
  const router = useRouter();
  const [showExamModal, setShowExamModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  if (!data) {
    return (
      <div className="p-6 bg-[#1e1e30] rounded-lg border border-[#2a2a3c] text-center">
        <p className="text-gray-400">University plugin is disabled</p>
      </div>
    );
  }

  const progress = getSemesterProgress(data.currentSemester);
  const studentName = data.settings?.studentName;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Find "next" class
  let foundNext = false;
  const classStatuses = data.todaysClasses.map((slot) => {
    const status = getClassStatus(slot);
    if (status === "future" && !foundNext) {
      foundNext = true;
      return "next";
    }
    return status;
  });

  const totalCredits = data.totalCredits ?? data.courses.reduce((sum: number, c: any) => sum + (c.credits || 0), 0);

  const handleSaved = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-[#1e1e30] to-[#12121c] border border-[#2a2a3c]">
        <h1 className="text-2xl font-bold text-white">
          {getGreeting()}{studentName ? `, ${studentName}` : ""}
        </h1>
        <p className="text-sm text-gray-400 mt-1">{today}</p>
      </div>

      {/* Semester Progress */}
      {data.currentSemester && progress && (
        <div className="p-5 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-400">{data.currentSemester.name}</h3>
            <span className="text-xs text-gray-500">Week {progress.week} of {progress.totalWeeks}</span>
          </div>
          <div className="h-2.5 rounded-full bg-[#2a2a3c] overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-700"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-white">{progress.daysLeft}</div>
              <div className="text-[10px] text-gray-500 uppercase">Days Left</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">{data.courses.length}</div>
              <div className="text-[10px] text-gray-500 uppercase">Courses</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">{totalCredits}</div>
              <div className="text-[10px] text-gray-500 uppercase">Credits</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "New Note", icon: "📝", href: "/uni/notes" },
          { label: "Write Summary", icon: "📋", action: () => setShowSummaryModal(true) },
          { label: "Add Grade", icon: "📊", action: () => setShowGradeModal(true) },
          { label: "Add Exam", icon: "📅", action: () => setShowExamModal(true) },
        ].map((btn) => (
          btn.href ? (
            <Link
              key={btn.label}
              href={btn.href}
              className="flex items-center gap-2 p-3 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] hover:bg-[#2a2a3c] transition-colors text-sm text-gray-300"
            >
              <span>{btn.icon}</span>
              <span>{btn.label}</span>
            </Link>
          ) : (
            <button
              key={btn.label}
              onClick={btn.action}
              className="flex items-center gap-2 p-3 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] hover:bg-[#2a2a3c] transition-colors text-sm text-gray-300"
            >
              <span>{btn.icon}</span>
              <span>{btn.label}</span>
            </button>
          )
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Classes */}
          <div className="p-5 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-400">Today&apos;s Classes</h3>
              <Link href="/uni/schedule" className="text-xs text-blue-400 hover:text-blue-300">View schedule</Link>
            </div>
            {data.todaysClasses.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No classes today</p>
            ) : (
              <div className="space-y-2">
                {data.todaysClasses.map((slot: any, i: number) => {
                  const status = classStatuses[i];
                  return (
                    <div
                      key={slot.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        status === "now" ? "bg-green-500/5 border-green-500/30" :
                        status === "next" ? "bg-amber-500/5 border-amber-500/30" :
                        status === "past" ? "bg-[#1e1e30] border-[#2a2a3c] opacity-50" :
                        "bg-[#1e1e30] border-[#2a2a3c]"
                      }`}
                    >
                      <div className="text-xs text-gray-500 w-24 flex-shrink-0">
                        {slot.startTime} - {slot.endTime}
                      </div>
                      <div className="flex-1">
                        <span className="text-white text-sm">{slot.course.name}</span>
                        <span className="text-xs text-gray-500 ml-2 capitalize">{slot.type}</span>
                        {slot.location && <span className="text-xs text-gray-600 ml-2">{slot.location}</span>}
                      </div>
                      {status === "now" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-400 animate-pulse">
                          Now
                        </span>
                      )}
                      {status === "next" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400">
                          Next
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Exams */}
          <div className="p-5 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-400">Upcoming Exams</h3>
              <Link href="/uni/exams" className="text-xs text-blue-400 hover:text-blue-300">View all</Link>
            </div>
            {data.upcomingExams.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No upcoming exams</p>
            ) : (
              <div className="space-y-2">
                {data.upcomingExams.map((exam: any) => {
                  const days = getDaysUntil(exam.date);
                  return (
                    <div key={exam.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#1e1e30] border border-[#2a2a3c]">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm">{exam.title}</span>
                          {exam.course && (
                            <span className="text-[10px] font-mono text-gray-500">{exam.course.code}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(exam.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${getUrgencyColor(days)}`}>
                        {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* GPA Ring */}
          <GPAOverview
            semesterGPA={data.semesterGPA}
            cumulativeGPA={data.cumulativeGPA}
            targetGPA={data.settings?.targetGPA}
          />

          {/* Recent Grades */}
          {data.recentGrades && data.recentGrades.length > 0 && (
            <div className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-400">Recent Grades</h3>
                <Link href="/uni/grades" className="text-xs text-blue-400 hover:text-blue-300">View all</Link>
              </div>
              <div className="space-y-2">
                {data.recentGrades.slice(0, 5).map((g: any) => {
                  const pct = g.maxScore > 0 ? (g.score / g.maxScore) * 100 : 0;
                  const color = pct >= 80 ? "text-green-400" : pct >= 60 ? "text-yellow-400" : "text-red-400";
                  return (
                    <div key={g.id} className="flex items-center justify-between py-1.5">
                      <div className="min-w-0">
                        <span className="text-sm text-white truncate block">{g.name}</span>
                        <span className="text-[10px] text-gray-500">{g.course?.code}</span>
                      </div>
                      <span className={`text-sm font-medium ${color}`}>{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ExamFormModal isOpen={showExamModal} onClose={() => setShowExamModal(false)} onSaved={handleSaved} courses={data.courses} />
      <GradeItemModal isOpen={showGradeModal} onClose={() => setShowGradeModal(false)} onSaved={handleSaved} courses={data.courses} />
      <SummaryFormModal isOpen={showSummaryModal} onClose={() => setShowSummaryModal(false)} onSaved={handleSaved} courses={data.courses} />
    </div>
  );
}
