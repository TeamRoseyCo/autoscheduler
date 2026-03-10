"use client";

import { useState, useMemo } from "react";
import { ClassSlotModal } from "./class-slot-modal";
import { GCalDetectModal } from "./gcal-detect-modal";
import { useRouter } from "next/navigation";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_HEIGHT = 60; // px per hour

const COLOR_BG_MAP: Record<string, string> = {
  indigo: "bg-indigo-500/20 border-l-indigo-500", blue: "bg-blue-500/20 border-l-blue-500",
  green: "bg-green-500/20 border-l-green-500", emerald: "bg-emerald-500/20 border-l-emerald-500",
  teal: "bg-teal-500/20 border-l-teal-500", purple: "bg-purple-500/20 border-l-purple-500",
  pink: "bg-pink-500/20 border-l-pink-500", rose: "bg-rose-500/20 border-l-rose-500",
  amber: "bg-amber-500/20 border-l-amber-500", orange: "bg-orange-500/20 border-l-orange-500",
};

const COLOR_TEXT_MAP: Record<string, string> = {
  indigo: "text-indigo-300", blue: "text-blue-300", green: "text-green-300",
  emerald: "text-emerald-300", teal: "text-teal-300", purple: "text-purple-300",
  pink: "text-pink-300", rose: "text-rose-300", amber: "text-amber-300", orange: "text-orange-300",
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

interface TimetableGridProps {
  slots: any[];
  courses: any[];
}

export function TimetableGrid({ slots, courses }: TimetableGridProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editSlot, setEditSlot] = useState<any>(null);
  const [prefillDay, setPrefillDay] = useState<number | undefined>();
  const [prefillTime, setPrefillTime] = useState<string | undefined>();
  const [showDetect, setShowDetect] = useState(false);

  // Detect conflicts
  const conflicts = useMemo(() => {
    const conflictIds = new Set<string>();
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i], b = slots[j];
        if (a.dayOfWeek === b.dayOfWeek) {
          const aStart = timeToMinutes(a.startTime), aEnd = timeToMinutes(a.endTime);
          const bStart = timeToMinutes(b.startTime), bEnd = timeToMinutes(b.endTime);
          if (aStart < bEnd && bStart < aEnd) {
            conflictIds.add(a.id);
            conflictIds.add(b.id);
          }
        }
      }
    }
    return conflictIds;
  }, [slots]);

  const handleCellClick = (day: number, hour: number) => {
    setEditSlot(null);
    setPrefillDay(day);
    setPrefillTime(`${String(hour).padStart(2, "0")}:00`);
    setShowModal(true);
  };

  const handleSlotClick = (slot: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditSlot(slot);
    setPrefillDay(undefined);
    setPrefillTime(undefined);
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditSlot(null);
    router.refresh();
  };

  const totalHours = END_HOUR - START_HOUR;

  // Weekly stats
  const totalSlots = slots.length;
  const totalClassHours = slots.reduce((sum, s) => {
    return sum + (timeToMinutes(s.endTime) - timeToMinutes(s.startTime)) / 60;
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedule</h1>
          <p className="text-sm text-gray-400 mt-1">{totalSlots} classes, {totalClassHours.toFixed(1)} hours/week</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetect(true)}
            className="px-4 py-2 text-sm border border-[#2a2a3c] text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Detect from Calendar
          </button>
          <button
            onClick={() => { setEditSlot(null); setPrefillDay(undefined); setPrefillTime(undefined); setShowModal(true); }}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            + Add Class
          </button>
        </div>
      </div>

      {conflicts.size > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          Schedule conflicts detected! {conflicts.size} overlapping class slots.
        </div>
      )}

      <div className="rounded-lg bg-[#12121c] border border-[#2a2a3c] overflow-hidden">
        <div className="flex">
          {/* Time labels */}
          <div className="w-16 flex-shrink-0 border-r border-[#2a2a3c]">
            <div className="h-10 border-b border-[#2a2a3c]" />
            {Array.from({ length: totalHours }, (_, i) => (
              <div key={i} className="border-b border-[#2a2a3c]/50 flex items-start justify-end pr-2 pt-0.5" style={{ height: HOUR_HEIGHT }}>
                <span className="text-[10px] text-gray-600">
                  {((START_HOUR + i) % 12 || 12)}{(START_HOUR + i) < 12 ? "am" : "pm"}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DISPLAY_DAYS.map((day) => {
            const daySlots = slots.filter((s) => s.dayOfWeek === day);
            const isToday = new Date().getDay() === day;

            return (
              <div key={day} className="flex-1 border-r border-[#2a2a3c] last:border-r-0 min-w-0">
                {/* Day header */}
                <div className={`h-10 flex items-center justify-center border-b border-[#2a2a3c] text-xs font-medium ${
                  isToday ? "text-blue-400 bg-blue-500/5" : "text-gray-500"
                }`}>
                  {DAY_NAMES[day]}
                </div>

                {/* Time grid */}
                <div className="relative" style={{ height: totalHours * HOUR_HEIGHT }}>
                  {/* Hour lines */}
                  {Array.from({ length: totalHours }, (_, i) => (
                    <div
                      key={i}
                      className="absolute w-full border-b border-[#2a2a3c]/30 cursor-pointer hover:bg-[#1e1e30]/50"
                      style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                      onClick={() => handleCellClick(day, START_HOUR + i)}
                    />
                  ))}

                  {/* Class blocks */}
                  {daySlots.map((slot) => {
                    const startMin = timeToMinutes(slot.startTime);
                    const endMin = timeToMinutes(slot.endTime);
                    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                    const color = slot.course?.color || "indigo";
                    const isConflict = conflicts.has(slot.id);

                    return (
                      <div
                        key={slot.id}
                        className={`absolute left-0.5 right-0.5 rounded border-l-3 p-1.5 cursor-pointer overflow-hidden transition-opacity hover:opacity-90 ${
                          COLOR_BG_MAP[color] || "bg-indigo-500/20 border-l-indigo-500"
                        } ${isConflict ? "ring-1 ring-red-500/50" : ""}`}
                        style={{ top, height: Math.max(height, 24) }}
                        onClick={(e) => handleSlotClick(slot, e)}
                      >
                        <div className={`text-[10px] font-medium truncate ${COLOR_TEXT_MAP[color] || "text-indigo-300"}`}>
                          {slot.course?.code || "?"}
                        </div>
                        {height >= 40 && (
                          <div className="text-[9px] text-gray-500 truncate capitalize">{slot.type}</div>
                        )}
                        {height >= 55 && slot.location && (
                          <div className="text-[9px] text-gray-600 truncate">{slot.location}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ClassSlotModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditSlot(null); }}
        onSaved={handleSaved}
        courses={courses}
        slot={editSlot}
        prefillDay={prefillDay}
        prefillTime={prefillTime}
      />

      <GCalDetectModal
        isOpen={showDetect}
        onClose={() => setShowDetect(false)}
      />
    </div>
  );
}
