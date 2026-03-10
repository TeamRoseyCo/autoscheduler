import { prisma } from "@/lib/prisma";
import { getBusySlots, computeFreeSlots } from "@/lib/google-calendar";
import type { BusySlot } from "@/lib/google-calendar";
import { getColorForEnergyType } from "@/lib/utils";
import type { Availability, FreeSlot } from "@/types";
import type { Preferences } from "@/generated/prisma/client";

function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MIN_CHUNK_MINUTES = 30; // Smallest chunk we'll schedule

/**
 * Gather free slots for a given day, merging local + Google busy times.
 */
async function getFreeSlotsForDay(
  userId: string,
  dateKey: string,
  preferences: Preferences,
  options?: { overrideStart?: string; overrideEnd?: string }
): Promise<FreeSlot[]> {
  const workStart = options?.overrideStart || preferences.workStartTime || "09:00";
  const workEnd = options?.overrideEnd || preferences.workEndTime || "17:00";
  const timezone = preferences.timezone || "America/New_York";
  const breakMinutes = preferences.breakMinutes ?? 5;

  const existingBlocks = await prisma.scheduledBlock.findMany({
    where: { userId, date: dateKey },
    orderBy: { startTime: "asc" },
  });

  const localBusy: BusySlot[] = existingBlocks.map((b) => ({
    // Expand by transport buffer so travel time is also treated as busy
    start: new Date(new Date(b.startTime).getTime() - (b.transportBefore ?? 0) * 60 * 1000),
    end: new Date(new Date(b.endTime).getTime() + (b.transportAfter ?? 0) * 60 * 1000),
    availability: (b.availability || "busy") as Availability,
  }));

  let googleBusy: BusySlot[] = [];
  try {
    const dayStart = new Date(`${dateKey}T00:00:00`);
    const dayEnd = new Date(`${dateKey}T23:59:59`);
    googleBusy = await getBusySlots(userId, dayStart, dayEnd);
  } catch {
    // Google Calendar unavailable
  }

  const allBusy: BusySlot[] = [...localBusy, ...googleBusy];

  const busyWithBreaks: BusySlot[] = allBusy.map((b) => ({
    ...b,
    end: new Date(b.end.getTime() + breakMinutes * 60 * 1000),
  }));

  return computeFreeSlots(busyWithBreaks, workStart, workEnd, dateKey, timezone);
}

/**
 * Find the next free slot that fits `durationMinutes`.
 * Optionally starts searching from a specific date (e.g. a task's deadline day)
 * instead of today, so tasks get placed on/near their target day.
 * If no single slot fits the full duration, returns the largest available
 * slot (at least MIN_CHUNK_MINUTES) so callers can schedule a partial chunk.
 */
export async function findNextFreeSlot(
  userId: string,
  durationMinutes: number,
  preferredTimeWindow?: string | null,
  energyType?: string | null,
  startFrom?: Date | null,
  maxDays?: number
): Promise<{ date: string; startTime: Date; endTime: Date; isPartial?: boolean } | null> {
  const preferences = await prisma.preferences.findUnique({
    where: { userId },
  }) as Preferences | null;

  if (!preferences) return null;

  const now = new Date();
  // Use startFrom if provided and it's in the future, otherwise use now
  const searchStart = startFrom && startFrom.getTime() > now.getTime()
    ? startFrom
    : now;

  // Pass 1: look for a slot that fits the full duration (existing behavior)
  // Pass 2: if nothing fits, find the biggest gap we can fill a chunk into
  const searchDays = maxDays ?? 7;

  for (const allowPartial of [false, true]) {
    for (let dayOffset = 0; dayOffset < searchDays; dayOffset++) {
      const targetDate = new Date(searchStart);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dateKey = dateToKey(targetDate);
      const isToday = dateToKey(targetDate) === dateToKey(now);

      let freeSlots = await getFreeSlotsForDay(userId, dateKey, preferences);

      // For today, also look at evening slots (after work hours)
      if (isToday) {
        const workEnd = preferences.workEndTime || "17:00";
        const nowHH = String(now.getHours()).padStart(2, "0");
        const nowMM = String(now.getMinutes()).padStart(2, "0");
        const nowHHMM = `${nowHH}:${nowMM}`;
        const eveningStart = nowHHMM > workEnd ? nowHHMM : workEnd;
        if (eveningStart < "23:00") {
          const eveningSlots = await getFreeSlotsForDay(userId, dateKey, preferences, {
            overrideStart: eveningStart,
            overrideEnd: "23:30",
          });
          const existingKeys = new Set(freeSlots.map((s) => s.start.getTime()));
          for (const s of eveningSlots) {
            if (!existingKeys.has(s.start.getTime())) {
              freeSlots = [...freeSlots, s];
            }
          }
        }
      }

      // Filter out slots before the effective cutoff (now, or startFrom if later)
      const cutoff = searchStart.getTime() > now.getTime() ? searchStart : now;
      const isSearchStartDay = dateToKey(targetDate) === dateToKey(searchStart);
      const needsTimeFilter = isToday || (isSearchStartDay && searchStart.getTime() > now.getTime());

      const effectiveSlots = needsTimeFilter
        ? freeSlots.filter((s) => s.end.getTime() > cutoff.getTime()).map((s) => ({
            ...s,
            start: s.start.getTime() < cutoff.getTime() ? roundUpTo15Min(cutoff) : s.start,
            durationMinutes: s.start.getTime() < cutoff.getTime()
              ? Math.round((s.end.getTime() - roundUpTo15Min(cutoff).getTime()) / 60000)
              : s.durationMinutes,
          }))
        : freeSlots;

      // Filter by energy type — only use slots that allow this task's energy
      const energyFilteredSlots = energyType
        ? effectiveSlots.filter((s) => !s.allowedEnergy || s.allowedEnergy.includes(energyType as "deep" | "light" | "admin"))
        : effectiveSlots;

      // Filter by preferred time window
      const preferredSlots = preferredTimeWindow
        ? filterByTimeWindow(energyFilteredSlots, preferredTimeWindow)
        : energyFilteredSlots;

      // For short tasks (< MIN_CHUNK_MINUTES), use their actual duration as the threshold
      const effectiveMinChunk = Math.min(MIN_CHUNK_MINUTES, durationMinutes);

      if (!allowPartial) {
        // Try preferred slots first, then all energy-eligible slots — full duration only
        for (const slots of [preferredSlots, energyFilteredSlots]) {
          for (const slot of slots) {
            if (slot.durationMinutes >= durationMinutes) {
              return {
                date: dateKey,
                startTime: slot.start,
                endTime: new Date(slot.start.getTime() + durationMinutes * 60000),
              };
            }
          }
        }
      } else {
        // Find the biggest slot we can use as a chunk
        // Prefer: preferred window first, then any energy-eligible, pick the largest
        for (const slots of [preferredSlots, energyFilteredSlots]) {
          let best: FreeSlot | null = null;
          for (const slot of slots) {
            if (slot.durationMinutes >= effectiveMinChunk) {
              if (!best || slot.durationMinutes > best.durationMinutes) {
                best = slot;
              }
            }
          }
          if (best) {
            const chunkMinutes = Math.min(best.durationMinutes, durationMinutes);
            return {
              date: dateKey,
              startTime: best.start,
              endTime: new Date(best.start.getTime() + chunkMinutes * 60000),
              isPartial: chunkMinutes < durationMinutes,
            };
          }
        }
      }
    }
  }

  return null;
}

function roundUpTo15Min(date: Date): Date {
  const ms = date.getTime();
  const fifteenMin = 15 * 60 * 1000;
  return new Date(Math.ceil(ms / fifteenMin) * fifteenMin);
}

function filterByTimeWindow(slots: FreeSlot[], window: string): FreeSlot[] {
  return slots.filter((s) => {
    const hour = s.start.getHours();
    switch (window) {
      case "morning": return hour < 12;
      case "afternoon": return hour >= 12 && hour < 17;
      case "evening": return hour >= 17;
      default: return true;
    }
  });
}

/** Priority weight for scheduling order: lower = scheduled first */
const PRIORITY_WEIGHT: Record<string, number> = {
  asap: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Reschedule ALL pending (non-completed) tasks for a user in priority order.
 * Higher priority → sooner deadline → longer duration tasks get the best slots.
 * Deletes existing blocks for each task before re-scheduling.
 */
export async function rescheduleAllTasks(userId: string) {
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      completed: false,
      taskStatus: { notIn: ["completed", "cancelled"] },
    },
    include: { project: { select: { color: true } } },
  });

  // Sort: priority (asap>high>medium>low), then deadline (soonest first, null last),
  // then duration (longest first to claim big slots before they fragment)
  tasks.sort((a, b) => {
    const pa = PRIORITY_WEIGHT[a.priority] ?? 2;
    const pb = PRIORITY_WEIGHT[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;

    // Deadline: soonest first, nulls last
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    if (da !== db) return da - db;

    // Longest duration first
    return b.durationMinutes - a.durationMinutes;
  });

  // Clear all existing blocks for these tasks first (batch delete)
  const taskIds = tasks.map((t) => t.id);
  if (taskIds.length > 0) {
    await prisma.scheduledBlock.deleteMany({
      where: { userId, taskId: { in: taskIds } },
    });
  }

  // Schedule each in priority order so high-priority tasks claim the best slots
  const results = [];
  for (const task of tasks) {
    try {
      const block = await autoScheduleTaskInternal(userId, task);
      if (block) results.push(block);
    } catch (err) {
      console.error(`Reschedule failed for task ${task.id}:`, err);
    }
  }

  return results;
}

/**
 * Auto-schedule a task by finding free slots and creating ScheduledBlock(s).
 * NEW: If the task is too big for any single slot, it splits into chunks
 * across multiple gaps, filling dead time intelligently.
 */
export async function autoScheduleTask(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId, userId },
    include: { project: { select: { color: true } } },
  });

  if (!task || task.completed) return null;

  // Delete any existing scheduled blocks for this task before re-scheduling
  await prisma.scheduledBlock.deleteMany({
    where: { userId, taskId: task.id },
  });

  return autoScheduleTaskInternal(userId, task);
}

/** Core scheduling logic — takes a task object directly (no DB fetch/delete). */
async function autoScheduleTaskInternal(
  userId: string,
  task: { id: string; title: string; durationMinutes: number; priority: string; energyType: string; preferredTimeWindow: string | null; deadline?: Date | string | null; project?: { color: string } | null }
) {
  let remainingMinutes = task.durationMinutes;
  const blocks = [];

  // ASAP tasks bypass time-window preference — schedule into the very next free slot
  const effectiveTimeWindow = task.priority === "asap" ? null : task.preferredTimeWindow;

  // If the task has a deadline, start searching from the beginning of that day
  // so habit tasks (deadline = their target day) get placed on the right day
  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const startFrom = deadlineDate
    ? new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate())
    : null;

  // Keep scheduling chunks until the full task is placed (up to 3 chunks max)
  const effectiveMinChunk = Math.min(MIN_CHUNK_MINUTES, task.durationMinutes);
  for (let i = 0; i < 3 && remainingMinutes >= effectiveMinChunk; i++) {
    const slot = await findNextFreeSlot(
      userId,
      remainingMinutes,
      effectiveTimeWindow,
      task.energyType,
      startFrom
    );

    if (!slot) break;

    const chunkMinutes = Math.round(
      (slot.endTime.getTime() - slot.startTime.getTime()) / 60000
    );

    const block = await prisma.scheduledBlock.create({
      data: {
        userId,
        taskId: task.id,
        title: task.title,
        startTime: slot.startTime,
        endTime: slot.endTime,
        date: slot.date,
        color: task.project?.color || getColorForEnergyType(task.energyType),
        googleEventId: null,
      },
    });

    blocks.push(block);
    remainingMinutes -= chunkMinutes;

    if (!slot.isPartial) break;
  }

  return blocks.length > 0 ? blocks[0] : null;
}
