"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CourseFormModal } from "./course-form-modal";
import { ClassSlotModal } from "./class-slot-modal";
import { ExamFormModal } from "./exam-form-modal";
import { GradeItemModal } from "./grade-item-modal";
import { SummaryFormModal } from "./summary-form-modal";
import { ResourceFormModal } from "./resource-form-modal";

const TABS = ["Overview", "Class Slots", "Exams", "Grades", "Notes", "Summaries", "Resources"] as const;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-500", blue: "bg-blue-500", green: "bg-green-500",
  emerald: "bg-emerald-500", teal: "bg-teal-500", purple: "bg-purple-500",
  pink: "bg-pink-500", rose: "bg-rose-500", amber: "bg-amber-500", orange: "bg-orange-500",
};

interface CourseDetailProps {
  course: any;
  semesters: any[];
  courses: any[];
}

export function CourseDetail({ course, semesters, courses }: CourseDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("Overview");
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editSlot, setEditSlot] = useState<any>(null);
  const [showExamModal, setShowExamModal] = useState(false);
  const [editExam, setEditExam] = useState<any>(null);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [editGrade, setEditGrade] = useState<any>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [editSummary, setEditSummary] = useState<any>(null);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editResource, setEditResource] = useState<any>(null);

  const handleSaved = () => router.refresh();

  const handleDeleteCourse = async () => {
    if (!confirm("Delete this course and all its data?")) return;
    await fetch(`/api/uni/courses/${course.id}`, { method: "DELETE" });
    router.push("/uni/courses");
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm("Delete this class slot?")) return;
    await fetch(`/api/uni/class-slots/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm("Delete this exam?")) return;
    await fetch(`/api/uni/exams/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const handleDeleteGrade = async (id: string) => {
    if (!confirm("Delete this grade?")) return;
    await fetch(`/api/uni/grades/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const handleDeleteSummary = async (id: string) => {
    if (!confirm("Delete this summary?")) return;
    await fetch(`/api/uni/summaries/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const handleDeleteResource = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    await fetch(`/api/uni/resources/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/uni/courses" className="text-sm text-blue-400 hover:text-blue-300 mb-2 inline-block">&larr; Back to Courses</Link>
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-4 h-4 rounded-full ${COLOR_MAP[course.color] || "bg-indigo-500"}`} />
            <h1 className="text-3xl font-bold text-white">{course.name}</h1>
          </div>
          <p className="text-gray-400">{course.code}</p>
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            {course.professor && <span>Prof. {course.professor}</span>}
            {course.room && <span>Room: {course.room}</span>}
            {course.credits && <span>{course.credits} credits</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEditCourse(true)} className="px-3 py-1.5 text-sm border border-[#2a2a3c] text-gray-300 hover:bg-[#2a2a3c] rounded-lg">
            Edit Course
          </button>
          <button onClick={handleDeleteCourse} className="px-3 py-1.5 text-sm border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg">
            Delete Course
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2a2a3c] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab ? "text-blue-400 border-blue-400" : "text-gray-400 border-transparent hover:text-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Class Slots", count: course.classSlots.length },
            { label: "Exams", count: course.exams.length },
            { label: "Grade Items", count: course.gradeItems.length },
            { label: "Notes", count: course.notes.length },
            { label: "Summaries", count: course.summaries.length },
            { label: "Resources", count: course.resources.length },
          ].map((s) => (
            <div key={s.label} className="p-4 bg-[#12121c] rounded-lg border border-[#2a2a3c]">
              <p className="text-2xl font-bold text-white">{s.count}</p>
              <p className="text-sm text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Class Slots */}
      {activeTab === "Class Slots" && (
        <div className="space-y-2">
          <div className="flex justify-end mb-2">
            <button onClick={() => { setEditSlot(null); setShowSlotModal(true); }} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">+ Add Slot</button>
          </div>
          {course.classSlots.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No class slots</p>
          ) : (
            course.classSlots.map((slot: any) => (
              <div key={slot.id} className="flex items-center justify-between p-3 bg-[#12121c] rounded border border-[#2a2a3c]">
                <div>
                  <span className="text-white">{DAY_NAMES[slot.dayOfWeek]}</span>
                  <span className="text-gray-400 ml-2">{slot.startTime} - {slot.endTime}</span>
                  <span className="text-xs text-gray-500 ml-2 capitalize">{slot.type}</span>
                  {slot.location && <span className="text-xs text-gray-500 ml-2">{slot.location}</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditSlot(slot); setShowSlotModal(true); }} className="text-xs text-gray-500 hover:text-white px-2 py-1">Edit</button>
                  <button onClick={() => handleDeleteSlot(slot.id)} className="text-xs text-gray-500 hover:text-red-400 px-2 py-1">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Exams */}
      {activeTab === "Exams" && (
        <div className="space-y-2">
          <div className="flex justify-end mb-2">
            <button onClick={() => { setEditExam(null); setShowExamModal(true); }} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">+ Add Exam</button>
          </div>
          {course.exams.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No exams</p>
          ) : (
            course.exams.map((exam: any) => (
              <div key={exam.id} className="flex items-center justify-between p-3 bg-[#12121c] rounded border border-[#2a2a3c]">
                <div>
                  <span className="text-white">{exam.title}</span>
                  <span className="text-gray-400 ml-2 text-sm">{new Date(exam.date).toLocaleDateString()}</span>
                  <span className="text-xs text-gray-500 ml-2">{exam.type}{exam.weight ? ` - ${exam.weight}%` : ""}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditExam(exam); setShowExamModal(true); }} className="text-xs text-gray-500 hover:text-white px-2 py-1">Edit</button>
                  <button onClick={() => handleDeleteExam(exam.id)} className="text-xs text-gray-500 hover:text-red-400 px-2 py-1">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Grades */}
      {activeTab === "Grades" && (
        <div className="space-y-2">
          <div className="flex justify-end mb-2">
            <button onClick={() => { setEditGrade(null); setShowGradeModal(true); }} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">+ Add Grade</button>
          </div>
          {course.gradeItems.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No grades</p>
          ) : (
            course.gradeItems.map((grade: any) => {
              const pct = grade.maxScore > 0 ? (grade.score / grade.maxScore) * 100 : 0;
              const color = pct >= 80 ? "text-green-400" : pct >= 60 ? "text-yellow-400" : "text-red-400";
              return (
                <div key={grade.id} className="flex items-center justify-between p-3 bg-[#12121c] rounded border border-[#2a2a3c]">
                  <div>
                    <span className="text-white">{grade.name}</span>
                    <span className="text-xs text-gray-500 ml-2 capitalize">{grade.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-300 text-sm">{grade.score}/{grade.maxScore}</span>
                    <span className={`text-sm font-medium ${color}`}>{pct.toFixed(0)}%</span>
                    <button onClick={() => { setEditGrade(grade); setShowGradeModal(true); }} className="text-xs text-gray-500 hover:text-white px-2 py-1">Edit</button>
                    <button onClick={() => handleDeleteGrade(grade.id)} className="text-xs text-gray-500 hover:text-red-400 px-2 py-1">Delete</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Notes */}
      {activeTab === "Notes" && (
        <div className="space-y-2">
          {course.notes.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No notes</p>
          ) : (
            course.notes.map((note: any) => (
              <Link key={note.id} href="/uni/notes" className="block p-3 bg-[#12121c] rounded border border-[#2a2a3c] hover:bg-[#1a1a2e]">
                <p className="text-white font-medium">{note.title}</p>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{note.content}</p>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Summaries */}
      {activeTab === "Summaries" && (
        <div className="space-y-2">
          <div className="flex justify-end mb-2">
            <button onClick={() => { setEditSummary(null); setShowSummaryModal(true); }} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">+ Add Summary</button>
          </div>
          {course.summaries.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No summaries</p>
          ) : (
            course.summaries.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-[#12121c] rounded border border-[#2a2a3c]">
                <div>
                  <span className="text-white">{new Date(s.date).toLocaleDateString()}</span>
                  <span className="text-xs text-gray-500 ml-2 capitalize">{s.type}</span>
                  {s.topics && <span className="text-xs text-gray-400 ml-2">{s.topics}</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditSummary(s); setShowSummaryModal(true); }} className="text-xs text-gray-500 hover:text-white px-2 py-1">Edit</button>
                  <button onClick={() => handleDeleteSummary(s.id)} className="text-xs text-gray-500 hover:text-red-400 px-2 py-1">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Resources */}
      {activeTab === "Resources" && (
        <div className="space-y-2">
          <div className="flex justify-end mb-2">
            <button onClick={() => { setEditResource(null); setShowResourceModal(true); }} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">+ Add Resource</button>
          </div>
          {course.resources.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No resources</p>
          ) : (
            course.resources.map((res: any) => (
              <div key={res.id} className="flex items-center justify-between p-3 bg-[#12121c] rounded border border-[#2a2a3c]">
                <div className="flex items-center gap-2">
                  <span>{TYPE_ICONS[res.type] || "📄"}</span>
                  <span className="text-white">{res.title}</span>
                  {res.url && <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-[200px]">{res.url}</a>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditResource(res); setShowResourceModal(true); }} className="text-xs text-gray-500 hover:text-white px-2 py-1">Edit</button>
                  <button onClick={() => handleDeleteResource(res.id)} className="text-xs text-gray-500 hover:text-red-400 px-2 py-1">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      <CourseFormModal isOpen={showEditCourse} onClose={() => setShowEditCourse(false)} onSaved={handleSaved} semesters={semesters} course={course} />
      <ClassSlotModal isOpen={showSlotModal} onClose={() => { setShowSlotModal(false); setEditSlot(null); }} onSaved={handleSaved} courses={[course]} slot={editSlot} />
      <ExamFormModal isOpen={showExamModal} onClose={() => { setShowExamModal(false); setEditExam(null); }} onSaved={handleSaved} courses={[course]} exam={editExam} />
      <GradeItemModal isOpen={showGradeModal} onClose={() => { setShowGradeModal(false); setEditGrade(null); }} onSaved={handleSaved} courses={[course]} grade={editGrade} />
      <SummaryFormModal isOpen={showSummaryModal} onClose={() => { setShowSummaryModal(false); setEditSummary(null); }} onSaved={handleSaved} courses={[course]} summary={editSummary} />
      <ResourceFormModal isOpen={showResourceModal} onClose={() => { setShowResourceModal(false); setEditResource(null); }} onSaved={handleSaved} courses={[course]} resource={editResource} />
    </div>
  );
}

const TYPE_ICONS: Record<string, string> = { link: "🔗", file: "📄", textbook: "📚", video: "🎥", website: "🌐" };
