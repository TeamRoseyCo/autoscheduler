"use client";

import { useState } from "react";
import type { CalendarEventData } from "@/components/week-calendar";
import { EmojiText } from "@/components/emoji-text";
import { isLaylatulQadr, toHijri } from "@/lib/hijri";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEventData[];
  onDateClick: (date: Date) => void;
  onEventClick?: (event: CalendarEventData) => void;
  showHijri?: boolean;
  showLaylatulQadr?: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_BAR_COLORS: Record<string, string> = {
  indigo: "bg-indigo-500/20 border-indigo-400/40 text-indigo-200",
  emerald: "bg-emerald-500/20 border-emerald-400/40 text-emerald-200",
  amber: "bg-amber-500/20 border-amber-400/40 text-amber-200",
  gray: "bg-slate-500/20 border-slate-400/40 text-slate-200",
  rose: "bg-rose-500/20 border-rose-400/40 text-rose-200",
  cyan: "bg-cyan-500/20 border-cyan-400/40 text-cyan-200",
  violet: "bg-violet-500/20 border-violet-400/40 text-violet-200",
  orange: "bg-orange-500/20 border-orange-400/40 text-orange-200",
};

const EVENT_DOT_COLORS: Record<string, string> = {
  indigo: "bg-indigo-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  gray: "bg-slate-400",
  rose: "bg-rose-400",
  cyan: "bg-cyan-400",
  violet: "bg-violet-400",
  orange: "bg-orange-400",
};

function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthGrid(date: Date): Date[][] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks: Date[][] = [];
  const current = new Date(startDate);

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "p" : "a";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2, "0")}${ampm}`;
}

// Strip leading emoji from title for compact display
function compactTitle(title: string): string {
  return title.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\uFE0F?\s*/u, "");
}

export function MonthView({ currentDate, events, onDateClick, onEventClick, showHijri = false, showLaylatulQadr = false }: MonthViewProps) {
  const weeks = getMonthGrid(currentDate);
  const todayKey = dateToKey(new Date());
  const currentMonth = currentDate.getMonth();
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

  // Group events by date and sort by start time
  const eventsByDate: Record<string, CalendarEventData[]> = {};
  for (const ev of events) {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  }
  for (const key of Object.keys(eventsByDate)) {
    eventsByDate[key].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  const MAX_VISIBLE = 3;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-[#2a2a3c]">
        {DAY_NAMES.map((name) => (
          <div key={name} className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
            {name}
          </div>
        ))}
      </div>

      {/* Weeks grid */}
      <div className="flex-1 grid grid-rows-6">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-[#222235] min-h-0">
            {week.map((day) => {
              const key = dateToKey(day);
              const isToday = key === todayKey;
              const isCurrentMonth = day.getMonth() === currentMonth;
              const dayEvents = eventsByDate[key] || [];
              const visibleEvents = dayEvents.slice(0, MAX_VISIBLE);
              const overflow = dayEvents.length - MAX_VISIBLE;

              return (
                <div
                  key={key}
                  className={`relative flex flex-col border-r border-[#222235] overflow-hidden ${
                    !isCurrentMonth ? "opacity-40" : ""
                  }`}
                >
                  {/* Date number - clickable */}
                  <button
                    onClick={() => onDateClick(day)}
                    className="flex items-center p-1 hover:bg-[#1a1a2a] transition-colors"
                  >
                    <span className="relative">
                      {showLaylatulQadr && isLaylatulQadr(day) && (
                        <span className="absolute inset-0 -m-0.5 rounded-full ring-2 ring-red-500/70" />
                      )}
                      <span
                        className={`relative z-10 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                          isToday
                            ? "bg-blue-500 text-white"
                            : isCurrentMonth
                            ? "text-gray-300"
                            : "text-gray-600"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </span>
                    {showHijri && isCurrentMonth && (() => {
                      const h = toHijri(day);
                      return h.day > 0 ? (
                        <span className="text-[8px] text-amber-500/50 ml-0.5">{h.day}</span>
                      ) : null;
                    })()}
                    {dayEvents.length > 0 && (
                      <span className="ml-auto text-[10px] text-gray-500 pr-1">
                        {dayEvents.length}
                      </span>
                    )}
                  </button>

                  {/* Event bars */}
                  <div className="flex-1 px-0.5 pb-0.5 space-y-px overflow-hidden">
                    {visibleEvents.map((ev) => {
                      const isCompleted = ev.status === "completed";
                      const barColors = EVENT_BAR_COLORS[ev.color] || EVENT_BAR_COLORS.gray;

                      return (
                        <button
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(ev);
                          }}
                          onMouseEnter={() => setHoveredEvent(ev.id)}
                          onMouseLeave={() => setHoveredEvent(null)}
                          className={`w-full flex items-center gap-1 rounded px-1 py-px text-left border transition-all group relative ${barColors} ${
                            isCompleted ? "opacity-50 line-through" : ""
                          } hover:brightness-125`}
                          title={`${formatTime(ev.startTime)} ${ev.title}`}
                        >
                          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${EVENT_DOT_COLORS[ev.color] || EVENT_DOT_COLORS.gray}`} />
                          <span className="text-[10px] font-medium text-gray-400 flex-shrink-0">
                            {formatTime(ev.startTime)}
                          </span>
                          <span className="text-[10px] truncate flex-1">
                            {compactTitle(ev.title)}
                          </span>

                          {/* Hover tooltip */}
                          {hoveredEvent === ev.id && (
                            <div className="absolute left-0 bottom-full mb-1 z-50 bg-[#1e1e30] border border-[#2a2a3c] rounded-lg shadow-xl p-2.5 min-w-48 pointer-events-none">
                              <p className="text-xs font-medium text-gray-100 mb-1">
                                <EmojiText text={ev.title} emojiSize={12} />
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {formatTime(ev.startTime)} — {formatTime(ev.endTime)}
                              </p>
                              {ev.location && (
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  {ev.location}
                                </p>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {/* Overflow indicator */}
                    {overflow > 0 && (
                      <button
                        onClick={() => onDateClick(day)}
                        className="w-full text-center text-[10px] text-gray-500 hover:text-gray-300 transition-colors py-px"
                      >
                        +{overflow} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
