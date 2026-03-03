"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import type { ScheduledBlock } from "@/generated/prisma/client";
import type { CalendarViewMode } from "@/types";
import type { ProjectWithCounts } from "@/lib/actions/projects";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightPanel } from "@/components/right-panel";
import { NewEventModal } from "@/components/new-event-modal";
import { SearchModal } from "@/components/search-modal";
import { NewTaskModal } from "@/components/new-task-modal";
import { ProjectFormModal } from "@/components/project-form-modal";
import { AIProjectModal } from "@/components/ai-project-modal";
import { CalendarViewDropdown } from "@/components/calendar-view-dropdown";
import { MonthView } from "@/components/month-view";
import { EventDetailModal } from "@/components/event-detail-modal";
import { EventContextMenu } from "@/components/event-context-menu";
import { CompletionDialog } from "@/components/completion-dialog";
import { ProjectDetailModal } from "@/components/project-detail-modal";
import { ProjectContextMenu } from "@/components/project-context-menu";
import { EmojiText } from "@/components/emoji-text";
import { scheduleTodayAction, restoreScheduleAction } from "@/lib/actions/schedule";
import { rescheduleBlockForLater } from "@/lib/actions/reschedule";
import { deleteProject } from "@/lib/actions/projects";

const HOUR_HEIGHT = 64;
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SNAP_MINUTES = 15;
const SNAP_PX = (SNAP_MINUTES / 60) * HOUR_HEIGHT; // 16px

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---- Unified CalendarEventData ----

export interface CalendarEventData {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  color: string;
  source: "local" | "google";
  googleEventId?: string;
  taskId?: string;
  status?: "scheduled" | "in_progress" | "completed";
  availability?: "busy" | "free_tight" | "free_light" | "free";
  actualStartTime?: string;
  actualEndTime?: string;
  location?: string;
  transportBefore?: number;
  transportAfter?: number;
  transportMode?: string;
  taskMetric?: { id: string; name: string; unit: string; icon: string } | null;
}

// ---- Utilities ----

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const d = new Date(baseDate);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function getVisibleDates(baseDate: Date, view: CalendarViewMode): Date[] {
  if (view === "day") {
    return [new Date(baseDate)];
  }
  if (view === "4day") {
    const dates: Date[] = [];
    const d = new Date(baseDate);
    for (let i = 0; i < 4; i++) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }
  // week (and month uses its own grid)
  return getWeekDates(baseDate);
}

function getNavOffset(view: CalendarViewMode): number {
  switch (view) {
    case "day": return 1;
    case "4day": return 4;
    case "week": return 7;
    case "month": return 0; // handled separately
  }
}

function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function formatShortTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function snapToGrid(px: number): number {
  return Math.round(px / SNAP_PX) * SNAP_PX;
}

function pxToTime(px: number): { hours: number; minutes: number } {
  const totalMinutes = Math.round(((px / HOUR_HEIGHT) + START_HOUR) * 60);
  const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  return { hours: Math.floor(snapped / 60), minutes: snapped % 60 };
}

function formatHHMM(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function blocksToEvents(blocks: ScheduledBlock[]): CalendarEventData[] {
  return blocks.map((b) => {
    const block = b as ScheduledBlock & {
      status?: string;
      availability?: string;
      actualStartTime?: Date | string | null;
      actualEndTime?: Date | string | null;
      location?: string | null;
      transportBefore?: number | null;
      transportAfter?: number | null;
      transportMode?: string | null;
      task?: { metric?: { id: string; name: string; unit: string; icon: string } | null } | null;
    };
    return {
      id: b.id,
      title: b.title,
      startTime: typeof b.startTime === "string" ? b.startTime : new Date(b.startTime).toISOString(),
      endTime: typeof b.endTime === "string" ? b.endTime : new Date(b.endTime).toISOString(),
      date: b.date,
      color: b.color,
      source: "local" as const,
      googleEventId: b.googleEventId || undefined,
      taskId: b.taskId || undefined,
      status: (block.status as CalendarEventData["status"]) || "scheduled",
      availability: (block.availability as CalendarEventData["availability"]) || "busy",
      actualStartTime: block.actualStartTime
        ? (typeof block.actualStartTime === "string" ? block.actualStartTime : new Date(block.actualStartTime).toISOString())
        : undefined,
      actualEndTime: block.actualEndTime
        ? (typeof block.actualEndTime === "string" ? block.actualEndTime : new Date(block.actualEndTime).toISOString())
        : undefined,
      location: block.location || undefined,
      transportBefore: block.transportBefore ?? undefined,
      transportAfter: block.transportAfter ?? undefined,
      transportMode: block.transportMode || undefined,
      taskMetric: block.task?.metric ?? null,
    };
  });
}

function mergeEvents(
  localEvents: CalendarEventData[],
  googleEvents: CalendarEventData[]
): CalendarEventData[] {
  // Build a lookup of Google events by their ID so we can adopt their data
  const googleById = new Map<string, CalendarEventData>();
  for (const ev of googleEvents) {
    if (ev.googleEventId) googleById.set(ev.googleEventId, ev);
  }

  const localGoogleIds = new Set<string>();
  const processedLocal = localEvents.map((ev) => {
    if (!ev.googleEventId) return ev;
    localGoogleIds.add(ev.googleEventId);

    // This local block has been synced to Google Calendar — render it as a Google event
    // so it looks clean (gray, no strikethrough, no task checkbox) and matches the
    // corresponding Google Calendar entry.
    const gEvent = googleById.get(ev.googleEventId);
    return {
      ...ev,
      // Prefer the Google event's title in case it was edited there
      title: gEvent?.title ?? ev.title,
      color: "gray",
      source: "google" as const,
      // Clear task-completion styling
      status: undefined,
    };
  });

  // Filter out Google events already represented by a local block
  const dedupedGoogle = googleEvents.filter(
    (ev) => !ev.googleEventId || !localGoogleIds.has(ev.googleEventId)
  );

  return [...processedLocal, ...dedupedGoogle];
}

// Compute fetch date range for a view
function getFetchRange(baseDate: Date, view: CalendarViewMode): { startDate: string; endDate: string } {
  if (view === "month") {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 41); // 6 weeks
    return { startDate: dateToKey(startDate), endDate: dateToKey(endDate) };
  }
  const dates = getVisibleDates(baseDate, view);
  return { startDate: dateToKey(dates[0]), endDate: dateToKey(dates[dates.length - 1]) };
}

// ---- Color Styles (dark theme) ----

const EVENT_COLORS: Record<string, { bg: string; border: string; text: string; sub: string; dot: string }> = {
  indigo: {
    bg: "bg-indigo-500/20",
    border: "border-l-indigo-400",
    text: "text-indigo-200",
    sub: "text-indigo-300/60",
    dot: "bg-indigo-400",
  },
  emerald: {
    bg: "bg-emerald-500/20",
    border: "border-l-emerald-400",
    text: "text-emerald-200",
    sub: "text-emerald-300/60",
    dot: "bg-emerald-400",
  },
  amber: {
    bg: "bg-amber-500/20",
    border: "border-l-amber-400",
    text: "text-amber-200",
    sub: "text-amber-300/60",
    dot: "bg-amber-400",
  },
  gray: {
    bg: "bg-slate-500/20",
    border: "border-l-slate-400",
    text: "text-slate-200",
    sub: "text-slate-300/60",
    dot: "bg-slate-400",
  },
  rose: {
    bg: "bg-rose-500/20",
    border: "border-l-rose-400",
    text: "text-rose-200",
    sub: "text-rose-300/60",
    dot: "bg-rose-400",
  },
  cyan: {
    bg: "bg-cyan-500/20",
    border: "border-l-cyan-400",
    text: "text-cyan-200",
    sub: "text-cyan-300/60",
    dot: "bg-cyan-400",
  },
  violet: {
    bg: "bg-violet-500/20",
    border: "border-l-violet-400",
    text: "text-violet-200",
    sub: "text-violet-300/60",
    dot: "bg-violet-400",
  },
  orange: {
    bg: "bg-orange-500/20",
    border: "border-l-orange-400",
    text: "text-orange-200",
    sub: "text-orange-300/60",
    dot: "bg-orange-400",
  },
};

// ---- Transport Buffer Colors ----

const BUFFER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  indigo:  { bg: "bg-indigo-500/10",  border: "border-indigo-400/50",  text: "text-indigo-300/70"  },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-400/50", text: "text-emerald-300/70" },
  amber:   { bg: "bg-amber-500/10",   border: "border-amber-400/50",   text: "text-amber-300/70"   },
  gray:    { bg: "bg-slate-500/10",   border: "border-slate-400/50",   text: "text-slate-300/70"   },
  rose:    { bg: "bg-rose-500/10",    border: "border-rose-400/50",    text: "text-rose-300/70"    },
  cyan:    { bg: "bg-cyan-500/10",    border: "border-cyan-400/50",    text: "text-cyan-300/70"    },
  violet:  { bg: "bg-violet-500/10",  border: "border-violet-400/50",  text: "text-violet-300/70"  },
  orange:  { bg: "bg-orange-500/10",  border: "border-orange-400/50",  text: "text-orange-300/70"  },
};

const MODE_ICONS: Record<string, string> = {
  driving: "🚗",
  transit: "🚌",
  walking: "🚶",
  cycling: "🚴",
};

// ---- Overlap Layout (Google Calendar style) ----

interface LayoutInfo {
  column: number;
  totalColumns: number;
}

function computeOverlapLayout(events: CalendarEventData[]): Map<string, LayoutInfo> {
  const result = new Map<string, LayoutInfo>();
  if (events.length === 0) return result;

  // Convert events to intervals with pixel positions for comparison
  const intervals = events.map((ev) => {
    const start = new Date(ev.startTime);
    const end = new Date(ev.endTime);
    const startH = start.getHours() + start.getMinutes() / 60;
    const endH = end.getHours() + end.getMinutes() / 60;
    return { id: ev.id, start: startH, end: endH };
  });

  // Sort by start time, then by longer duration first
  intervals.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Group into overlapping clusters
  const clusters: typeof intervals[] = [];
  for (const interval of intervals) {
    let placed = false;
    for (const cluster of clusters) {
      // Check if this interval overlaps with any event in the cluster
      const overlaps = cluster.some(
        (c) => interval.start < c.end && interval.end > c.start
      );
      if (overlaps) {
        cluster.push(interval);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push([interval]);
    }
  }

  // Merge clusters that ended up connected transitively
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const overlaps = clusters[i].some((a) =>
          clusters[j].some((b) => a.start < b.end && a.end > b.start)
        );
        if (overlaps) {
          clusters[i].push(...clusters[j]);
          clusters.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  // For each cluster, assign columns using greedy algorithm
  for (const cluster of clusters) {
    // Re-sort cluster by start time
    cluster.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    const columns: { end: number }[] = []; // track end time of last event in each column
    const assignments = new Map<string, number>();

    for (const interval of cluster) {
      // Find first column where this event fits (no overlap)
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (interval.start >= columns[col].end) {
          columns[col].end = interval.end;
          assignments.set(interval.id, col);
          placed = true;
          break;
        }
      }
      if (!placed) {
        assignments.set(interval.id, columns.length);
        columns.push({ end: interval.end });
      }
    }

    const totalColumns = columns.length;
    for (const interval of cluster) {
      result.set(interval.id, {
        column: assignments.get(interval.id)!,
        totalColumns,
      });
    }
  }

  return result;
}

// ---- Drag/Resize state types ----

interface DragState {
  eventId: string;
  startMouseY: number;
  startMouseX: number;
  originalTop: number;
  originalHeight: number;
  originalDate: string;
  currentTop: number;
  currentDate: string;
}

interface ResizeState {
  eventId: string;
  startMouseY: number;
  originalHeight: number;
  currentHeight: number;
}

interface GridDragState {
  dateKey: string;
  startY: number;
  currentY: number;
  columnEl: HTMLElement;
}

// ---- Sub-Components ----

function CalendarEvent({
  event,
  onClick,
  onDragStart,
  onResizeStart,
  onContextMenu,
  onToggleComplete,
  isDragging,
  isResizing,
  dragTop,
  resizeHeight,
  layoutColumn,
  layoutTotalColumns,
}: {
  event: CalendarEventData;
  onClick: (event: CalendarEventData, rect: DOMRect) => void;
  onDragStart: (event: CalendarEventData, mouseY: number, top: number, height: number, mouseX: number) => void;
  onResizeStart: (event: CalendarEventData, mouseY: number, height: number) => void;
  onContextMenu: (event: CalendarEventData, x: number, y: number) => void;
  onToggleComplete: (event: CalendarEventData) => void;
  isDragging: boolean;
  isResizing: boolean;
  dragTop?: number;
  resizeHeight?: number;
  layoutColumn?: number;
  layoutTotalColumns?: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  // Live elapsed timer for in_progress events
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (event.status !== "in_progress" || !event.actualStartTime) return;
    const update = () => {
      const diff = Date.now() - new Date(event.actualStartTime!).getTime();
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(`${mins}:${String(secs).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [event.status, event.actualStartTime]);

  const startH = start.getHours() + start.getMinutes() / 60;
  // If end appears before start (crosses midnight), treat end as +24 hours
  const rawEndH = end.getHours() + end.getMinutes() / 60;
  const endH = rawEndH < startH ? rawEndH + 24 : rawEndH;

  const clampedStart = Math.max(startH, START_HOUR);
  const clampedEnd = Math.min(endH, END_HOUR);
  if (clampedEnd <= clampedStart) return null;

  const naturalTop = (clampedStart - START_HOUR) * HOUR_HEIGHT;
  const naturalHeight = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT - 2, 20);

  const top = isDragging && dragTop !== undefined ? dragTop : naturalTop;
  const height = isResizing && resizeHeight !== undefined ? resizeHeight : naturalHeight;

  const colors = EVENT_COLORS[event.color] || EVENT_COLORS.gray;
  const showTime = height > 34;

  // Compute overlap positioning
  const col = layoutColumn ?? 0;
  const totalCols = layoutTotalColumns ?? 1;
  const GAP = 2; // px gap between side-by-side events
  const widthPercent = 100 / totalCols;
  const leftPercent = col * widthPercent;
  // When dragging, use full width so the event isn't constrained to its column
  const posStyle: React.CSSProperties = isDragging
    ? { top: `${top}px`, height: `${height}px`, left: "4px", right: "4px" }
    : {
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${leftPercent}% + ${GAP}px)`,
        width: `calc(${widthPercent}% - ${GAP + 2}px)`,
      };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (elRef.current) {
      onClick(event, elRef.current.getBoundingClientRect());
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).dataset.resizeHandle) return;
    if ((e.target as HTMLElement).dataset.checkboxHandle) return;
    e.preventDefault();
    e.stopPropagation();
    onDragStart(event, e.clientY, naturalTop, naturalHeight, e.clientX);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onResizeStart(event, e.clientY, naturalHeight);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    if (event.source !== "local" || event.googleEventId) return;
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(event, e.clientX, e.clientY);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleComplete(event);
  };

  const isLocal = event.source === "local" && !event.googleEventId;
  const isCompleted = event.status === "completed";
  const isInProgress = event.status === "in_progress";

  return (
    <div
      ref={elRef}
      className={`absolute rounded-md border-l-[3px] ${colors.border} ${colors.bg} px-2 py-1 overflow-hidden cursor-grab hover:brightness-125 hover:shadow-lg transition-shadow group select-none ${
        isDragging ? "opacity-70 shadow-2xl z-30 cursor-grabbing" : ""
      } ${isResizing ? "z-30" : ""} ${isCompleted ? "opacity-50" : ""} ${isInProgress ? "ring-1 ring-red-500/50" : ""}`}
      style={posStyle}
      title={`${event.title}\n${formatShortTime(start)} - ${formatShortTime(end)}`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleRightClick}
    >
      <div className="flex items-start gap-1.5">
        {/* Checkbox for local events, decorative dot for google */}
        {isLocal ? (
          <button
            data-checkbox-handle="true"
            onClick={handleCheckboxClick}
            className={`w-3 h-3 rounded-full border-[1.5px] flex-shrink-0 mt-0.5 transition-colors flex items-center justify-center ${
              isCompleted
                ? "bg-emerald-500 border-emerald-400"
                : isInProgress
                  ? "border-red-400 animate-pulse"
                  : `${colors.border.replace("border-l-", "border-")} group-hover:border-white/50`
            }`}
          >
            {isCompleted && (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ) : (
          <div className={`w-3 h-3 rounded-full border-[1.5px] ${colors.border.replace("border-l-", "border-")} flex-shrink-0 mt-0.5 group-hover:border-white/50 transition-colors`} />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-medium leading-tight truncate ${colors.text} ${isCompleted ? "line-through opacity-70" : ""}`}>
            <EmojiText text={event.title} emojiSize={12} />
          </p>
          {showTime && !isInProgress && (
            <p className={`text-[10px] mt-0.5 truncate ${colors.sub}`}>
              {formatShortTime(start)} - {formatShortTime(end)}
            </p>
          )}
          {isInProgress && elapsed && (
            <p className="text-[10px] mt-0.5 truncate text-red-400 font-mono flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {elapsed}
            </p>
          )}
        </div>
        {event.availability && event.availability !== "busy" && (
          <span className={`flex-shrink-0 mt-0.5 text-[8px] font-bold leading-none rounded px-0.5 ${
            event.availability === "free" ? "bg-emerald-500/30 text-emerald-300" :
            event.availability === "free_light" ? "bg-cyan-500/30 text-cyan-300" :
            "bg-amber-500/30 text-amber-300"
          }`} title={
            event.availability === "free" ? "Free — all tasks allowed" :
            event.availability === "free_light" ? "Free (light) — light tasks only" :
            "Free (tight) — no deep work"
          }>
            {event.availability === "free" ? "F" : event.availability === "free_light" ? "L" : "T"}
          </span>
        )}
        {event.source === "google" && (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5 opacity-40">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>
      {/* Resize handle */}
      <div
        data-resize-handle="true"
        className="absolute bottom-0 left-0 right-0 h-[6px] cursor-ns-resize hover:bg-white/10 transition-colors"
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
}

// EventPopover removed — replaced by EventDetailModal

function CurrentTimeIndicator() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const hours = now.getHours() + now.getMinutes() / 60;
  if (hours < START_HOUR || hours >= END_HOUR) return null;

  const top = (hours - START_HOUR) * HOUR_HEIGHT;

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${top}px` }}>
      <div className="relative flex items-center">
        <div className="absolute -left-[5px] w-[10px] h-[10px] rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
        <div className="w-full h-[2px] bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.3)]" />
      </div>
    </div>
  );
}

// ---- Inline SVG Icons ----

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 8a5.5 5.5 0 019.66-3.5M13.5 8a5.5 5.5 0 01-9.66 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.16 1v3.5h-3.5M3.84 15v-3.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 8h8M8 4v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ---- Toast Component ----

function Toast({ message, onDismiss, onUndo, offsetBottom = "bottom-4" }: { message: string; onDismiss: () => void; onUndo?: () => void; offsetBottom?: string }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, onUndo ? 8000 : 4000);
    return () => clearTimeout(timer);
  }, [onDismiss, onUndo]);

  return (
    <div className={`fixed ${offsetBottom} right-4 z-50 bg-[#2a2a3c] border border-[#3a3a4c] text-sm text-gray-300 px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2`}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-amber-400 flex-shrink-0">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {message}
      {onUndo && (
        <button
          onClick={onUndo}
          className="ml-1 text-xs font-medium text-indigo-400 hover:text-indigo-200 border border-indigo-500/40 rounded px-2 py-0.5 transition-colors"
        >
          Undo
        </button>
      )}
      <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 ml-1">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ---- New Dropdown ----

function NewDropdown({ onNewEvent, onNewTask }: { onNewEvent: () => void; onNewTask: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg px-3 py-1.5 text-sm text-gray-200 bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-1.5"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        New
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="ml-0.5">
          <path d="M3 4l2 2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-[#1e1e30] border border-[#2a2a3c] rounded-lg shadow-xl z-50 py-1">
          <button
            onClick={() => { onNewEvent(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Event
          </button>
          <button
            onClick={() => { onNewTask(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Task
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Main Component ----

interface WeekCalendarProps {
  initialBlocks: ScheduledBlock[];
  initialDate: string;
  initialProjects?: ProjectWithCounts[];
}

export function WeekCalendar({ initialBlocks, initialDate, initialProjects = [] }: WeekCalendarProps) {
  const [localEvents, setLocalEvents] = useState<CalendarEventData[]>(() =>
    blocksToEvents(initialBlocks)
  );
  const [googleEvents, setGoogleEvents] = useState<CalendarEventData[]>([]);
  const [currentDate, setCurrentDate] = useState(() => new Date(initialDate + "T12:00:00"));
  const [view, setView] = useState<CalendarViewMode>("week");
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [googleAuthError, setGoogleAuthError] = useState(false);
  const [undoScheduleSnapshot, setUndoScheduleSnapshot] = useState<CalendarEventData[] | null>(null);
  const [projects, setProjects] = useState<ProjectWithCounts[]>(initialProjects);
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("calendar-sidebar-open");
      return stored === null ? true : stored === "true";
    }
    return true;
  });
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [showGoogleEvents, setShowGoogleEvents] = useState(true);
  const [showLocalEvents, setShowLocalEvents] = useState(true);
  const [newEventModalOpen, setNewEventModalOpen] = useState(false);
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [projectFormModalOpen, setProjectFormModalOpen] = useState(false);
  const [aiProjectModalOpen, setAIProjectModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null);
  const [contextMenu, setContextMenu] = useState<{ event: CalendarEventData; x: number; y: number } | null>(null);
  const [completionEvent, setCompletionEvent] = useState<CalendarEventData | null>(null);
  const [projectDetailId, setProjectDetailId] = useState<string | null>(null);
  const [projectContextMenu, setProjectContextMenu] = useState<{ projectId: string; x: number; y: number } | null>(null);
  const [editProjectData, setEditProjectData] = useState<{ id: string; name: string; description: string | null; color: string; deadline: string | Date | null } | null>(null);

  // Drag / Resize / Grid-create state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [gridDrag, setGridDrag] = useState<GridDragState | null>(null);
  const dragPreventClick = useRef(false);

  // New event modal pre-filled times from grid drag
  const [gridCreateDate, setGridCreateDate] = useState<string | undefined>();
  const [gridCreateStart, setGridCreateStart] = useState<string | undefined>();
  const [gridCreateEnd, setGridCreateEnd] = useState<string | undefined>();

  const visibleDates = getVisibleDates(currentDate, view);
  const todayKey = dateToKey(new Date());

  // Persist sidebar preference
  useEffect(() => {
    localStorage.setItem("calendar-sidebar-open", String(sidebarOpen));
  }, [sidebarOpen]);

  // Merge and filter events
  const allEvents = mergeEvents(
    showLocalEvents ? localEvents : [],
    showGoogleEvents ? googleEvents : []
  );

  // Group events by date — if an event is being dragged to a different day, place it in the target column
  const eventsByDate: Record<string, CalendarEventData[]> = {};
  for (const ev of allEvents) {
    const effectiveDate = (dragState && dragState.eventId === ev.id && dragState.currentDate !== ev.date)
      ? dragState.currentDate
      : ev.date;
    if (!eventsByDate[effectiveDate]) eventsByDate[effectiveDate] = [];
    eventsByDate[effectiveDate].push(ev);
  }

  // Fetch local blocks for date range
  const fetchLocalBlocks = useCallback(async (startDate: string, endDate: string) => {
    try {
      const res = await fetch(`/api/calendar/blocks?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const blocks: ScheduledBlock[] = await res.json();
        setLocalEvents(blocksToEvents(blocks));
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Fetch Google events for date range
  const fetchGoogleEvents = useCallback(async (startDate: string, endDate: string) => {
    try {
      const res = await fetch(`/api/calendar/google-events?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const events: CalendarEventData[] = await res.json();
        setGoogleEvents(events);
        setGoogleAuthError(false);
      } else {
        const data = await res.json().catch(() => null);
        const msg = data?.error || "Could not load Google Calendar events";
        console.error("Google Calendar error:", msg);
        // Detect auth-related failures — show reconnect banner instead of toast
        if (msg.includes("sign out") || msg.includes("refresh token") || msg.includes("expired") || msg.includes("revoked")) {
          setGoogleAuthError(true);
        } else {
          setToastMessage(msg);
        }
      }
    } catch {
      setToastMessage("Could not load Google Calendar events");
    }
  }, []);

  // Fetch all events for a given base date + view
  const fetchAllEvents = useCallback(
    async (baseDate: Date, v: CalendarViewMode) => {
      setLoading(true);
      const { startDate, endDate } = getFetchRange(baseDate, v);
      await Promise.all([fetchLocalBlocks(startDate, endDate), fetchGoogleEvents(startDate, endDate)]);
      setLoading(false);
    },
    [fetchLocalBlocks, fetchGoogleEvents]
  );

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Initial fetch for Google events + reschedule overdue
  useEffect(() => {
    const { startDate, endDate } = getFetchRange(currentDate, view);
    fetchGoogleEvents(startDate, endDate);

    // Reschedule overdue tasks on initial load
    fetch("/api/calendar/reschedule", { method: "POST" })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((result) => {
        if (result && result.rescheduled > 0) {
          setToastMessage(`Rescheduled ${result.rescheduled} overdue task${result.rescheduled !== 1 ? "s" : ""}`);
          fetchLocalBlocks(startDate, endDate);
        }
      })
      .catch(() => {
        // Silently fail
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for overdue tasks every 60 seconds and auto-reschedule
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/calendar/reschedule", { method: "POST" });
        if (!res.ok) return;
        const result = await res.json();
        if (result && result.rescheduled > 0) {
          setToastMessage(`Auto-rescheduled ${result.rescheduled} overdue task${result.rescheduled !== 1 ? "s" : ""}`);
          await fetchAllEvents(currentDate, view);
        }
      } catch {
        // Silently fail
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchAllEvents, currentDate, view]);

  // Navigation
  const navigate = useCallback(
    (offset: number) => {
      const d = new Date(currentDate);
      if (view === "month") {
        d.setMonth(d.getMonth() + offset);
      } else {
        d.setDate(d.getDate() + offset * getNavOffset(view));
      }
      setCurrentDate(d);
      fetchAllEvents(d, view);
    },
    [currentDate, view, fetchAllEvents]
  );

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    fetchAllEvents(today, view);
  }, [fetchAllEvents, view]);

  const handleDateSelect = useCallback(
    (date: Date) => {
      setCurrentDate(date);
      // When clicking a date in month view, switch to day view
      if (view === "month") {
        setView("day");
        fetchAllEvents(date, "day");
      } else {
        fetchAllEvents(date, view);
      }
    },
    [fetchAllEvents, view]
  );

  const handleViewChange = useCallback(
    (newView: CalendarViewMode) => {
      setView(newView);
      fetchAllEvents(currentDate, newView);
    },
    [currentDate, fetchAllEvents]
  );

  const handleRefresh = useCallback(() => {
    fetchAllEvents(currentDate, view);
  }, [fetchAllEvents, currentDate, view]);

  const handleUndoSchedule = useCallback(async () => {
    if (!undoScheduleSnapshot) return;
    const snapshot = undoScheduleSnapshot;
    setUndoScheduleSnapshot(null);
    try {
      await restoreScheduleAction(snapshot);
      await fetchAllEvents(currentDate, view);
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : "Undo failed");
    }
  }, [undoScheduleSnapshot, fetchAllEvents, currentDate, view]);

  const handleScheduleDay = useCallback(async () => {
    setScheduling(true);
    // Snapshot today's local blocks before the scheduler wipes them
    const today = dateToKey(new Date());
    const snapshot = localEvents.filter((e) => e.date === today);
    try {
      const result = await scheduleTodayAction();
      if (snapshot.length > 0) setUndoScheduleSnapshot(snapshot);
      if (result && 'usedLocalFallback' in result && result.usedLocalFallback) {
        setToastMessage(result.message);
      }
      await fetchAllEvents(currentDate, view);
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : "Scheduling failed");
    } finally {
      setScheduling(false);
    }
  }, [fetchAllEvents, currentDate, view, localEvents]);

  const handleEventCreated = useCallback(() => {
    fetchAllEvents(currentDate, view);
    fetchProjects();
  }, [fetchAllEvents, fetchProjects, currentDate, view]);

  const handleTaskCreated = useCallback(() => {
    fetchAllEvents(currentDate, view);
    fetchProjects();
  }, [fetchAllEvents, fetchProjects, currentDate, view]);

  const handleProjectCreated = useCallback(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleProjectEdit = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      setEditProjectData({
        id: data.id,
        name: data.name,
        description: data.description,
        color: data.color,
        deadline: data.deadline,
      });
      setProjectFormModalOpen(true);
      setProjectDetailId(null);
    } catch {
      // Silently fail
    }
  }, []);

  const handleProjectDelete = useCallback(async (projectId: string) => {
    try {
      await deleteProject(projectId);
      fetchProjects();
      if (projectDetailId === projectId) setProjectDetailId(null);
    } catch {
      setToastMessage("Failed to delete project");
    }
  }, [fetchProjects, projectDetailId]);

  const handleEventClick = useCallback(
    (event: CalendarEventData, _rect: DOMRect) => {
      if (dragPreventClick.current) {
        dragPreventClick.current = false;
        return;
      }
      setSelectedEvent(event);
    },
    []
  );

  const handleContextMenu = useCallback(
    (event: CalendarEventData, x: number, y: number) => {
      setContextMenu({ event, x, y });
    },
    []
  );

  const handleStartTask = useCallback(async () => {
    if (!contextMenu) return;
    const event = contextMenu.event;
    setContextMenu(null);
    try {
      const res = await fetch(`/api/calendar/blocks/${event.id}/start-now`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rescheduled > 0) {
          setToastMessage(`Task started · ${data.rescheduled} conflict${data.rescheduled === 1 ? "" : "s"} rescheduled`);
        }
      }
      await fetchAllEvents(currentDate, view);
    } catch {
      setToastMessage("Failed to start task");
    }
  }, [contextMenu, fetchAllEvents, currentDate, view]);

  const handleStopTask = useCallback(() => {
    if (!contextMenu) return;
    setCompletionEvent(contextMenu.event);
    setContextMenu(null);
  }, [contextMenu]);

  const handleToggleComplete = useCallback(async (event: CalendarEventData) => {
    if (event.status === "completed") {
      // Revert to scheduled
      try {
        await fetch(`/api/calendar/blocks/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "scheduled",
            actualStartTime: null,
            actualEndTime: null,
          }),
        });
        await fetchAllEvents(currentDate, view);
      } catch {
        setToastMessage("Failed to revert event");
      }
    } else {
      // Open completion dialog
      setCompletionEvent(event);
    }
  }, [fetchAllEvents, currentDate, view]);

  const handleCompletionConfirm = useCallback(async (data: {
    actualStartTime: string;
    actualEndTime: string;
    rescheduleRemaining: boolean;
    remainingMinutes: number;
    metricEntry?: { metricId: string; value: number; notes?: string } | null;
  }) => {
    if (!completionEvent) return;
    try {
      await fetch(`/api/calendar/blocks/${completionEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          // Move the block to the actual times so it renders at the right position
          startTime: data.actualStartTime,
          endTime: data.actualEndTime,
          // Update the day-key so the block appears in the correct column
          date: dateToKey(new Date(data.actualStartTime)),
          actualStartTime: data.actualStartTime,
          actualEndTime: data.actualEndTime,
        }),
      });

      // Log metric entry if provided
      if (data.metricEntry) {
        await fetch("/api/metrics/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metricId: data.metricEntry.metricId,
            value: data.metricEntry.value,
            taskId: completionEvent.taskId,
            notes: data.metricEntry.notes,
          }),
        });
      }

      if (data.rescheduleRemaining && data.remainingMinutes > 0) {
        const res = await fetch(`/api/calendar/blocks/${completionEvent.id}/reschedule-remaining`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remainingMinutes: data.remainingMinutes }),
        });
        if (res.ok) {
          setToastMessage(`Rescheduled ${data.remainingMinutes} remaining minutes`);
        }
      }

      setCompletionEvent(null);
      await fetchAllEvents(currentDate, view);
      fetchProjects();
    } catch {
      setToastMessage("Failed to complete task");
    }
  }, [completionEvent, fetchAllEvents, fetchProjects, currentDate, view]);

  const handleRescheduleForLater = useCallback(async () => {
    if (!contextMenu) return;
    const event = contextMenu.event;
    setContextMenu(null);

    try {
      const result = await rescheduleBlockForLater(event.id);
      if (result.success) {
        setToastMessage(`Rescheduled to ${result.date}`);
      } else {
        setToastMessage(result.message || "Could not reschedule");
      }
      await fetchAllEvents(currentDate, view);
    } catch {
      setToastMessage("Failed to reschedule task");
    }
  }, [contextMenu, fetchAllEvents, currentDate, view]);

  const handleRevertToScheduled = useCallback(async () => {
    if (!contextMenu) return;
    const event = contextMenu.event;
    setContextMenu(null);
    try {
      await fetch(`/api/calendar/blocks/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "scheduled",
          actualStartTime: null,
          actualEndTime: null,
        }),
      });
      await fetchAllEvents(currentDate, view);
      fetchProjects();
    } catch {
      setToastMessage("Failed to revert event");
    }
  }, [contextMenu, fetchAllEvents, fetchProjects, currentDate, view]);

  // ---- Drag to move ----
  const handleDragStart = useCallback(
    (event: CalendarEventData, mouseY: number, top: number, height: number, mouseX: number) => {
      if (event.source === "google") return; // Don't drag Google events
      setSelectedEvent(null);
      setDragState({
        eventId: event.id,
        startMouseY: mouseY,
        startMouseX: mouseX,
        originalTop: top,
        originalHeight: height,
        originalDate: event.date,
        currentTop: top,
        currentDate: event.date,
      });
    },
    []
  );

  const handleResizeStart = useCallback(
    (event: CalendarEventData, mouseY: number, height: number) => {
      if (event.source === "google") return;
      setSelectedEvent(null);
      setResizeState({
        eventId: event.id,
        startMouseY: mouseY,
        originalHeight: height,
        currentHeight: height,
      });
    },
    []
  );

  // Global mousemove/mouseup for drag and resize
  useEffect(() => {
    if (!dragState && !resizeState && !gridDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragState) {
        const deltaY = e.clientY - dragState.startMouseY;
        const newTop = snapToGrid(dragState.originalTop + deltaY);
        const clampedTop = Math.max(0, Math.min(newTop, TOTAL_HOURS * HOUR_HEIGHT - dragState.originalHeight));

        // Determine which day column the mouse is over for cross-day dragging
        let newDate = dragState.currentDate;
        if (columnsRef.current) {
          const columns = columnsRef.current.children;
          // First child is the time gutter (w-[60px]), rest are day columns
          for (let i = 1; i < columns.length; i++) {
            const col = columns[i] as HTMLElement;
            const rect = col.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX < rect.right) {
              const dateIdx = i - 1; // offset by 1 for the time gutter
              if (dateIdx >= 0 && dateIdx < visibleDates.length) {
                newDate = dateToKey(visibleDates[dateIdx]);
              }
              break;
            }
          }
        }

        setDragState((prev) => prev ? { ...prev, currentTop: clampedTop, currentDate: newDate } : null);
      }
      if (resizeState) {
        const deltaY = e.clientY - resizeState.startMouseY;
        const newHeight = snapToGrid(Math.max(SNAP_PX, resizeState.originalHeight + deltaY));
        setResizeState((prev) => prev ? { ...prev, currentHeight: newHeight } : null);
      }
      if (gridDrag) {
        const rect = gridDrag.columnEl.getBoundingClientRect();
        const relativeY = e.clientY - rect.top + gridDrag.columnEl.parentElement!.scrollTop;
        setGridDrag((prev) => prev ? { ...prev, currentY: relativeY } : null);
      }
    };

    const handleMouseUp = async () => {
      if (dragState) {
        const movedPx = Math.abs(dragState.currentTop - dragState.originalTop);
        const dateChanged = dragState.currentDate !== dragState.originalDate;
        if (movedPx > 2 || dateChanged) {
          dragPreventClick.current = true;
          const time = pxToTime(dragState.currentTop);
          const startDate = new Date(`${dragState.currentDate}T${formatHHMM(time.hours, time.minutes)}:00`);
          const durationMs = (dragState.originalHeight / HOUR_HEIGHT) * 3600000;
          const endDate = new Date(startDate.getTime() + durationMs);

          try {
            await fetch(`/api/calendar/blocks/${dragState.eventId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                startTime: startDate.toISOString(),
                endTime: endDate.toISOString(),
                date: dragState.currentDate,
              }),
            });
            await fetchAllEvents(currentDate, view);
          } catch {
            setToastMessage("Failed to move event");
          }
        }
        setDragState(null);
      }

      if (resizeState) {
        const deltaHeight = Math.abs(resizeState.currentHeight - resizeState.originalHeight);
        if (deltaHeight > 2) {
          dragPreventClick.current = true;
          // Find the event to compute its new endTime
          const event = allEvents.find((e) => e.id === resizeState.eventId);
          if (event) {
            const startMs = new Date(event.startTime).getTime();
            const newDurationMs = (resizeState.currentHeight / HOUR_HEIGHT) * 3600000;
            const newEnd = new Date(startMs + newDurationMs);

            try {
              await fetch(`/api/calendar/blocks/${resizeState.eventId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  endTime: newEnd.toISOString(),
                }),
              });
              await fetchAllEvents(currentDate, view);
            } catch {
              setToastMessage("Failed to resize event");
            }
          }
        }
        setResizeState(null);
      }

      if (gridDrag) {
        const topY = Math.min(gridDrag.startY, gridDrag.currentY);
        const bottomY = Math.max(gridDrag.startY, gridDrag.currentY);
        const heightPx = bottomY - topY;

        if (heightPx >= SNAP_PX) {
          const startTime = pxToTime(snapToGrid(topY));
          const endTime = pxToTime(snapToGrid(bottomY));

          setGridCreateDate(gridDrag.dateKey);
          setGridCreateStart(formatHHMM(startTime.hours, startTime.minutes));
          setGridCreateEnd(formatHHMM(endTime.hours, endTime.minutes));
          setNewEventModalOpen(true);
        }
        setGridDrag(null);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, resizeState, gridDrag, allEvents, fetchAllEvents, currentDate, view, visibleDates]);

  // Grid click-to-create: mousedown on day column background
  const handleColumnMouseDown = useCallback(
    (e: React.MouseEvent, dateKey: string) => {
      // Only handle left click on the background (not on events)
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-calendar-event]")) return;

      const columnEl = e.currentTarget as HTMLElement;
      const rect = columnEl.getBoundingClientRect();
      const relativeY = e.clientY - rect.top + columnEl.parentElement!.scrollTop;

      setGridDrag({
        dateKey,
        startY: relativeY,
        currentY: relativeY,
        columnEl,
      });
    },
    []
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Scroll to 7 AM on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (7 - START_HOUR) * HOUR_HEIGHT;
    }
  }, []);

  // Header text
  const getHeaderText = () => {
    if (view === "month") {
      return `${FULL_MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (view === "day") {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    }
    const first = visibleDates[0];
    const last = visibleDates[visibleDates.length - 1];
    if (first.getMonth() === last.getMonth()) {
      return `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
    }
    return `${MONTH_NAMES[first.getMonth()]} – ${MONTH_NAMES[last.getMonth()]} ${first.getFullYear()}`;
  };

  // Close event modal and clear grid-create state
  const handleEventModalClose = useCallback(() => {
    setNewEventModalOpen(false);
    setGridCreateDate(undefined);
    setGridCreateStart(undefined);
    setGridCreateEnd(undefined);
  }, []);

  return (
    <div className="flex h-full bg-[#12121c]">
      {/* Left Sidebar */}
      <LeftSidebar
        collapsed={!sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        onSearchClick={() => setSearchModalOpen(true)}
        projects={projects}
        onAddProjectClick={() => { setEditProjectData(null); setProjectFormModalOpen(true); }}
        onAIProjectClick={() => setAIProjectModalOpen(true)}
        onProjectClick={(id) => setProjectDetailId(id)}
        onProjectContextMenu={(id, x, y) => setProjectContextMenu({ projectId: id, x, y })}
      />

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#16161f] border-b border-[#2a2a3c] flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-200 bg-[#2a2a3c] hover:bg-[#3a3a4c] transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors"
            >
              <ChevronLeft />
            </button>
            <button
              onClick={() => navigate(1)}
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors"
            >
              <ChevronRight />
            </button>
            <h2 className="text-lg font-semibold text-gray-100 ml-1">{getHeaderText()}</h2>
            {(loading || scheduling) && (
              <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleScheduleDay}
              disabled={scheduling}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Schedule today with AI"
            >
              <ScheduleIcon />
              <span className="hidden sm:inline">Schedule Day</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh events"
            >
              <RefreshIcon />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <NewDropdown
              onNewEvent={() => setNewEventModalOpen(true)}
              onNewTask={() => setNewTaskModalOpen(true)}
            />
            <CalendarViewDropdown view={view} onChange={handleViewChange} />
            {rightPanelOpen ? (
              <button
                onClick={() => setRightPanelOpen(false)}
                className="rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors flex items-center gap-1"
                title="Close side panel"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => setRightPanelOpen(true)}
                className="rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors flex items-center gap-1"
                title="Open side panel"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 4L2 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Google Calendar reconnect banner */}
        {googleAuthError && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-900/30 border-b border-amber-700/40 flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-amber-400 flex-shrink-0">
              <path d="M8 1l7 13H1L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8 6v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-sm text-amber-200">Google Calendar disconnected — your token expired.</span>
            <button
              onClick={() => {
                // Sign out via NextAuth then redirect to home to trigger fresh sign-in
                fetch("/api/auth/signout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csrfToken: "" }) })
                  .finally(() => { window.location.href = "/"; });
              }}
              className="ml-auto px-3 py-1 text-xs font-medium rounded-md bg-amber-600 hover:bg-amber-500 text-white transition-colors"
            >
              Sign out &amp; reconnect
            </button>
            <button
              onClick={() => setGoogleAuthError(false)}
              className="text-amber-400/60 hover:text-amber-300 transition-colors p-0.5"
              title="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Month View */}
        {view === "month" ? (
          <MonthView
            currentDate={currentDate}
            events={allEvents}
            onDateClick={handleDateSelect}
          />
        ) : (
          <>
            {/* Day Headers */}
            <div className="flex bg-[#16161f] border-b border-[#2a2a3c] flex-shrink-0">
              <div className="w-[60px] flex-shrink-0 flex items-center justify-center">
                <span className="text-[10px] text-gray-600 font-medium">GMT+</span>
              </div>
              {visibleDates.map((date) => {
                const key = dateToKey(date);
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 border-l border-[#2a2a3c] ${
                      isToday ? "bg-[#1a1a30]" : ""
                    }`}
                  >
                    <span className={`text-xs font-medium uppercase tracking-wide ${isToday ? "text-blue-400" : "text-gray-500"}`}>
                      {DAY_NAMES_SHORT[date.getDay()]}
                    </span>
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                        isToday ? "bg-blue-500 text-white" : "text-gray-300"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Scrollable Time Grid */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
              <div ref={columnsRef} className="flex" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
                {/* Time gutter */}
                <div className="w-[60px] flex-shrink-0 relative bg-[#12121c] sticky left-0 z-10">
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute right-3 text-[11px] text-gray-600 leading-none select-none"
                      style={{ top: `${i * HOUR_HEIGHT - 7}px` }}
                    >
                      {i > 0 ? formatHour(START_HOUR + i) : ""}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {visibleDates.map((date) => {
                  const key = dateToKey(date);
                  const isToday = key === todayKey;
                  const dayEvents = eventsByDate[key] || [];

                  // Compute grid-drag placeholder for this column
                  const showPlaceholder = gridDrag && gridDrag.dateKey === key;
                  const placeholderTop = showPlaceholder ? snapToGrid(Math.min(gridDrag!.startY, gridDrag!.currentY)) : 0;
                  const placeholderHeight = showPlaceholder ? Math.max(SNAP_PX, snapToGrid(Math.abs(gridDrag!.currentY - gridDrag!.startY))) : 0;

                  return (
                    <div
                      key={key}
                      className={`flex-1 relative border-l border-[#2a2a3c] min-w-0 ${
                        isToday ? "bg-[#161628]" : ""
                      }`}
                      onMouseDown={(e) => handleColumnMouseDown(e, key)}
                    >
                      {/* Hour gridlines */}
                      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                        <div
                          key={`h-${i}`}
                          className="absolute left-0 right-0 border-t border-[#222235]"
                          style={{ top: `${i * HOUR_HEIGHT}px` }}
                        />
                      ))}
                      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                        <div
                          key={`hh-${i}`}
                          className="absolute left-0 right-0 border-t border-[#1a1a2a]"
                          style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                        />
                      ))}

                      {/* Grid-drag placeholder */}
                      {showPlaceholder && placeholderHeight >= SNAP_PX && (
                        <div
                          className="absolute left-1 right-1 rounded-md bg-blue-500/20 border border-blue-500/40 pointer-events-none z-10"
                          style={{ top: `${placeholderTop}px`, height: `${placeholderHeight}px` }}
                        >
                          <p className="text-[10px] text-blue-300 px-2 py-1">
                            {(() => {
                              const s = pxToTime(placeholderTop);
                              const e = pxToTime(placeholderTop + placeholderHeight);
                              return `${formatHHMM(s.hours, s.minutes)} - ${formatHHMM(e.hours, e.minutes)}`;
                            })()}
                          </p>
                        </div>
                      )}

                      {/* Events */}
                      {(() => {
                        const layout = computeOverlapLayout(dayEvents);
                        return dayEvents.map((event) => {
                          const info = layout.get(event.id);

                          // Compute transport buffer blocks
                          const start = new Date(event.startTime);
                          const end = new Date(event.endTime);
                          const startH = start.getHours() + start.getMinutes() / 60;
                          const rawEndH = end.getHours() + end.getMinutes() / 60;
                          const endH = rawEndH < startH ? rawEndH + 24 : rawEndH;
                          const clampedStart = Math.max(startH, START_HOUR);
                          const clampedEnd = Math.min(endH, END_HOUR);
                          const eventTop = (clampedStart - START_HOUR) * HOUR_HEIGHT;
                          const eventHeight = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT - 2, 20);

                          const col = info?.column ?? 0;
                          const totalCols = info?.totalColumns ?? 1;
                          const GAP = 2;
                          const widthPct = 100 / totalCols;
                          const leftPct = col * widthPct;
                          const bufferStyle: React.CSSProperties = {
                            left: `calc(${leftPct}% + ${GAP}px)`,
                            width: `calc(${widthPct}% - ${GAP + 2}px)`,
                          };

                          const bc = BUFFER_COLORS[event.color] || BUFFER_COLORS.gray;
                          const modeIcon = MODE_ICONS[event.transportMode || "driving"] || "🚗";

                          return (
                            <Fragment key={event.id}>
                              {/* Transport buffer — before */}
                              {(event.transportBefore ?? 0) > 0 && clampedEnd > clampedStart && (() => {
                                const bufH = ((event.transportBefore ?? 0) / 60) * HOUR_HEIGHT;
                                const bufTop = Math.max(0, eventTop - bufH);
                                const actualH = eventTop - bufTop;
                                if (actualH <= 0) return null;
                                return (
                                  <div
                                    className={`absolute rounded-t-md border border-dashed ${bc.border} ${bc.bg} ${bc.text} overflow-hidden pointer-events-none flex items-center justify-center`}
                                    style={{ top: `${bufTop}px`, height: `${actualH}px`, ...bufferStyle }}
                                  >
                                    <span className="text-[9px] truncate px-1">{modeIcon} {event.transportBefore}m</span>
                                  </div>
                                );
                              })()}

                              {/* Transport buffer — after */}
                              {(event.transportAfter ?? 0) > 0 && clampedEnd > clampedStart && (() => {
                                const bufH = ((event.transportAfter ?? 0) / 60) * HOUR_HEIGHT;
                                const bufTop = eventTop + eventHeight;
                                const maxH = Math.max(0, END_HOUR * HOUR_HEIGHT - bufTop);
                                const actualH = Math.min(bufH, maxH);
                                if (actualH <= 0) return null;
                                return (
                                  <div
                                    className={`absolute rounded-b-md border border-dashed ${bc.border} ${bc.bg} ${bc.text} overflow-hidden pointer-events-none flex items-center justify-center`}
                                    style={{ top: `${bufTop}px`, height: `${actualH}px`, ...bufferStyle }}
                                  >
                                    <span className="text-[9px] truncate px-1">{modeIcon} {event.transportAfter}m</span>
                                  </div>
                                );
                              })()}

                              <div data-calendar-event>
                                <CalendarEvent
                                  event={event}
                                  onClick={handleEventClick}
                                  onDragStart={handleDragStart}
                                  onResizeStart={handleResizeStart}
                                  onContextMenu={handleContextMenu}
                                  onToggleComplete={handleToggleComplete}
                                  isDragging={dragState?.eventId === event.id}
                                  isResizing={resizeState?.eventId === event.id}
                                  dragTop={dragState?.eventId === event.id ? dragState.currentTop : undefined}
                                  resizeHeight={resizeState?.eventId === event.id ? resizeState.currentHeight : undefined}
                                  layoutColumn={info?.column}
                                  layoutTotalColumns={info?.totalColumns}
                                />
                              </div>
                            </Fragment>
                          );
                        });
                      })()}

                      {isToday && <CurrentTimeIndicator />}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Panel */}
      {rightPanelOpen && (
        <RightPanel
          onDateSelect={handleDateSelect}
          selectedDate={currentDate}
          onClose={() => setRightPanelOpen(false)}
          showGoogleEvents={showGoogleEvents}
          onToggleGoogleEvents={() => setShowGoogleEvents((v) => !v)}
          showLocalEvents={showLocalEvents}
          onToggleLocalEvents={() => setShowLocalEvents((v) => !v)}
        />
      )}

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onSaved={handleEventCreated}
        onStartTask={async (ev) => {
          try {
            const res = await fetch(`/api/calendar/blocks/${ev.id}/start-now`, {
              method: "POST",
            });
            if (res.ok) {
              const data = await res.json();
              if (data.rescheduled > 0) {
                setToastMessage(`Task started · ${data.rescheduled} conflict${data.rescheduled === 1 ? "" : "s"} rescheduled`);
              }
            }
            await fetchAllEvents(currentDate, view);
          } catch { setToastMessage("Failed to start task"); }
        }}
        onStopTask={(ev) => {
          setCompletionEvent(ev);
        }}
      />

      {/* New Event Modal */}
      <NewEventModal
        isOpen={newEventModalOpen}
        onClose={handleEventModalClose}
        onCreated={handleEventCreated}
        defaultDate={gridCreateDate || dateToKey(currentDate)}
        defaultStartTime={gridCreateStart}
        defaultEndTime={gridCreateEnd}
      />

      {/* New Task Modal */}
      <NewTaskModal
        isOpen={newTaskModalOpen}
        onClose={() => setNewTaskModalOpen(false)}
        onCreated={handleTaskCreated}
        projects={projects}
      />

      {/* Project Form Modal */}
      <ProjectFormModal
        isOpen={projectFormModalOpen}
        onClose={() => { setProjectFormModalOpen(false); setEditProjectData(null); }}
        onCreated={handleProjectCreated}
        editProject={editProjectData}
      />

      {/* AI Project Modal */}
      <AIProjectModal
        isOpen={aiProjectModalOpen}
        onClose={() => setAIProjectModalOpen(false)}
        onCreated={handleProjectCreated}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        events={allEvents}
        onNavigateToDate={handleDateSelect}
      />

      {/* Context Menu */}
      {contextMenu && (
        <EventContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          status={contextMenu.event.status || "scheduled"}
          hasTask={!!contextMenu.event.taskId}
          onStartTask={contextMenu.event.status === "completed" ? handleRevertToScheduled : handleStartTask}
          onStopTask={handleStopTask}
          onMarkComplete={() => {
            setCompletionEvent(contextMenu.event);
            setContextMenu(null);
          }}
          onReschedule={handleRescheduleForLater}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Completion Dialog */}
      <CompletionDialog
        event={completionEvent}
        onClose={() => setCompletionEvent(null)}
        onConfirm={handleCompletionConfirm}
      />

      {/* Project Detail Modal */}
      <ProjectDetailModal
        projectId={projectDetailId}
        onClose={() => setProjectDetailId(null)}
        onEdit={handleProjectEdit}
      />

      {/* Project Context Menu */}
      {projectContextMenu && (
        <ProjectContextMenu
          x={projectContextMenu.x}
          y={projectContextMenu.y}
          onEdit={() => handleProjectEdit(projectContextMenu.projectId)}
          onDelete={() => handleProjectDelete(projectContextMenu.projectId)}
          onClose={() => setProjectContextMenu(null)}
        />
      )}

      {/* Toast */}
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} offsetBottom={undoScheduleSnapshot ? "bottom-16" : "bottom-4"} />
      )}

      {/* Undo Schedule Toast */}
      {undoScheduleSnapshot && (
        <Toast
          message={`Schedule applied · ${undoScheduleSnapshot.length} block${undoScheduleSnapshot.length !== 1 ? "s" : ""} replaced`}
          onDismiss={() => setUndoScheduleSnapshot(null)}
          onUndo={handleUndoSchedule}
        />
      )}
    </div>
  );
}
