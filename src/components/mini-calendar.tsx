"use client";

import { useState, useCallback } from "react";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface MiniCalendarProps {
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
}

export function MiniCalendar({ onDateSelect, selectedDate }: MiniCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const selectedKey = selectedDate
    ? `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`
    : null;

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  // Previous month days to fill first row
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
  const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  const goToPrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }, [viewMonth, viewYear]);

  const goToNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }, [viewMonth, viewYear]);

  const goToToday = useCallback(() => {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
  }, [today]);

  // Build the 6-row grid
  const cells: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({
      day: daysInPrevMonth - i,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      month: viewMonth,
      year: viewYear,
      isCurrentMonth: true,
    });
  }

  // Next month leading days
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const remaining = 42 - cells.length; // 6 rows * 7 cols
  for (let d = 1; d <= remaining; d++) {
    cells.push({
      day: d,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
    });
  }

  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-200">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToToday}
            className="text-[11px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-[#2a2a3c] transition-colors"
          >
            Today
          </button>
          <button
            onClick={goToPrevMonth}
            className="p-1 text-gray-500 hover:text-gray-300 rounded hover:bg-[#2a2a3c] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={goToNextMonth}
            className="p-1 text-gray-500 hover:text-gray-300 rounded hover:bg-[#2a2a3c] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[10px] font-medium text-gray-600 py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {rows.map((row, ri) =>
          row.map((cell, ci) => {
            const cellKey = `${cell.year}-${cell.month}-${cell.day}`;
            const isToday = cellKey === todayKey;
            const isSelected = cellKey === selectedKey;

            return (
              <button
                key={`${ri}-${ci}`}
                onClick={() => {
                  const d = new Date(cell.year, cell.month, cell.day);
                  onDateSelect?.(d);
                }}
                className={`
                  h-7 w-full flex items-center justify-center text-[11px] rounded-full transition-colors
                  ${!cell.isCurrentMonth ? "text-gray-700" : "text-gray-400"}
                  ${isToday && !isSelected ? "bg-blue-500 text-white font-semibold" : ""}
                  ${isSelected ? "bg-blue-600 text-white font-semibold" : ""}
                  ${!isToday && !isSelected ? "hover:bg-[#2a2a3c]" : ""}
                `}
              >
                {cell.day}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
