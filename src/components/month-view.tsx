"use client";

import type { CalendarEventData } from "@/components/week-calendar";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEventData[];
  onDateClick: (date: Date) => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export function MonthView({ currentDate, events, onDateClick }: MonthViewProps) {
  const weeks = getMonthGrid(currentDate);
  const todayKey = dateToKey(new Date());
  const currentMonth = currentDate.getMonth();

  // Group events by date
  const eventsByDate: Record<string, CalendarEventData[]> = {};
  for (const ev of events) {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  }

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

              return (
                <button
                  key={key}
                  onClick={() => onDateClick(day)}
                  className={`relative p-1.5 border-r border-[#222235] text-left transition-colors hover:bg-[#1a1a2a] ${
                    !isCurrentMonth ? "opacity-40" : ""
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      isToday
                        ? "bg-blue-500 text-white"
                        : isCurrentMonth
                        ? "text-gray-300"
                        : "text-gray-600"
                    }`}
                  >
                    {day.getDate()}
                  </span>

                  {/* Event dots */}
                  {dayEvents.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5 px-0.5">
                      {dayEvents.slice(0, 3).map((ev, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${EVENT_DOT_COLORS[ev.color] || EVENT_DOT_COLORS.gray}`}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[8px] text-gray-500">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
