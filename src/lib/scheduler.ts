import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai";
import {
  getBusySlots,
  computeFreeSlots,
  createCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";
import type { BusySlot } from "@/lib/google-calendar";
import { getColorForEnergyType, parseTime } from "@/lib/utils";
import { z } from "zod/v4";
import type { ScheduledBlock, Preferences } from "@/generated/prisma/client";
import type { FreeSlot, Availability } from "@/types";

const scheduleResponseSchema = z.object({
  assignments: z.array(
    z.object({
      taskId: z.string(),
      startTime: z.string(), // HH:mm
      endTime: z.string(),   // HH:mm
    })
  ),
  unscheduled: z.array(
    z.object({
      taskId: z.string(),
      reason: z.string(),
    })
  ),
});

type TaskWithProject = {
  id: string;
  title: string;
  durationMinutes: number;
  priority: string;
  energyType: string;
  preferredTimeWindow: string | null;
  deadline: Date | null;
  project: { color: string } | null;
};

const MIN_CHUNK_MINUTES = 30;

/**
 * Local deterministic scheduler — used as fallback when OpenAI is unavailable (429, etc.).
 * Greedy approach: sort tasks by priority then deadline, place each in the first free slot.
 * NEW: If a task doesn't fit in any single slot, split it across multiple gaps.
 */
function localScheduleDay(
  tasks: TaskWithProject[],
  freeSlots: FreeSlot[],
  preferences: Preferences,
  targetDate: string
): { assignments: { taskId: string; startTime: string; endTime: string }[]; unscheduled: { taskId: string; reason: string }[] } {
  // Sort: high priority first, then earliest deadline
  const priorityOrder: Record<string, number> = { asap: -1, high: 0, medium: 1, low: 2 };
  const sorted = [...tasks].sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 1;
    const pb = priorityOrder[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  const deepStart = parseTime(preferences.deepWorkStart);
  const deepEnd = parseTime(preferences.deepWorkEnd);
  const deepStartMinutes = deepStart.hours * 60 + deepStart.minutes;
  const deepEndMinutes = deepEnd.hours * 60 + deepEnd.minutes;
  const breakMs = preferences.breakMinutes * 60 * 1000;

  // Track remaining free time in each slot
  const slotStates = freeSlots.map((s) => ({
    start: s.start.getTime(),
    end: s.end.getTime(),
    cursor: s.start.getTime(),
    allowedEnergy: s.allowedEnergy, // undefined = all types allowed
  }));

  const assignments: { taskId: string; startTime: string; endTime: string }[] = [];
  const unscheduled: { taskId: string; reason: string }[] = [];

  for (const task of sorted) {
    let remainingMs = task.durationMinutes * 60 * 1000;
    const minChunkMs = MIN_CHUNK_MINUTES * 60 * 1000;
    const taskEnergy = task.energyType as "deep" | "light" | "admin";

    // Filter slots this task's energy type is allowed in
    const canUseSlot = (slot: typeof slotStates[0]) =>
      !slot.allowedEnergy || slot.allowedEnergy.includes(taskEnergy);

    // For deep tasks, prefer deep work window slots
    const isDeep = task.energyType === "deep";
    const getSortedSlots = () => {
      const eligible = slotStates.filter(canUseSlot);
      return isDeep
        ? [...eligible].sort((a, b) => {
            const aInDeep = isInDeepWindow(a.cursor, deepStartMinutes, deepEndMinutes, targetDate);
            const bInDeep = isInDeepWindow(b.cursor, deepStartMinutes, deepEndMinutes, targetDate);
            if (aInDeep && !bInDeep) return -1;
            if (!aInDeep && bInDeep) return 1;
            return a.cursor - b.cursor;
          })
        : eligible;
    };

    // Pass 1: try to fit the whole task in one slot
    let placedFully = false;
    for (const slot of getSortedSlots()) {
      const available = slot.end - slot.cursor;
      if (available >= remainingMs) {
        const startTime = new Date(slot.cursor);
        const endTime = new Date(slot.cursor + remainingMs);

        assignments.push({
          taskId: task.id,
          startTime: formatHHMM(startTime),
          endTime: formatHHMM(endTime),
        });

        slot.cursor = endTime.getTime() + breakMs;
        remainingMs = 0;
        placedFully = true;
        break;
      }
    }

    // Pass 2: split into chunks across multiple gaps
    if (!placedFully) {
      let chunksPlaced = 0;
      for (let attempt = 0; attempt < 3 && remainingMs >= minChunkMs; attempt++) {
        // Find the largest available gap that allows this energy type
        let bestSlot: typeof slotStates[0] | null = null;
        for (const slot of getSortedSlots()) {
          const available = slot.end - slot.cursor;
          if (available >= minChunkMs) {
            if (!bestSlot || available > (bestSlot.end - bestSlot.cursor)) {
              bestSlot = slot;
            }
          }
        }

        if (!bestSlot) break;

        const available = bestSlot.end - bestSlot.cursor;
        const chunkMs = Math.min(available, remainingMs);

        const startTime = new Date(bestSlot.cursor);
        const endTime = new Date(bestSlot.cursor + chunkMs);

        assignments.push({
          taskId: task.id,
          startTime: formatHHMM(startTime),
          endTime: formatHHMM(endTime),
        });

        bestSlot.cursor = endTime.getTime() + breakMs;
        remainingMs -= chunkMs;
        chunksPlaced++;
      }

      if (remainingMs >= minChunkMs) {
        const scheduledMins = task.durationMinutes - Math.round(remainingMs / 60000);
        unscheduled.push({
          taskId: task.id,
          reason: scheduledMins > 0
            ? `Only ${scheduledMins} of ${task.durationMinutes} min fit today`
            : "No available slot fits this task",
        });
      }
    }
  }

  return { assignments, unscheduled };
}

function roundUpTo15Min(date: Date): Date {
  const ms = date.getTime();
  const fifteenMin = 15 * 60 * 1000;
  return new Date(Math.ceil(ms / fifteenMin) * fifteenMin);
}

function isInDeepWindow(cursorMs: number, deepStartMin: number, deepEndMin: number, targetDate: string): boolean {
  const d = new Date(cursorMs);
  const minuteOfDay = d.getHours() * 60 + d.getMinutes();
  return minuteOfDay >= deepStartMin && minuteOfDay < deepEndMin;
}

function formatHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function scheduleDay(userId: string, targetDate: string) {
  // 1. Load preferences
  const preferences = await prisma.preferences.findUnique({
    where: { userId },
  }) as Preferences | null;
  if (!preferences) {
    throw new Error("Please configure your preferences in Settings first.");
  }

  // 2. Load incomplete tasks with project info
  const tasks = await prisma.task.findMany({
    where: { userId, completed: false },
    include: { project: { select: { color: true } } },
    orderBy: [{ priority: "asc" }, { deadline: "asc" }],
  });

  if (tasks.length === 0) {
    return { scheduled: 0, unscheduled: 0, message: "No active tasks to schedule." };
  }

  // 3. Fetch busy slots from Google Calendar
  const dayStart = new Date(`${targetDate}T00:00:00`);
  const dayEnd = new Date(`${targetDate}T23:59:59`);
  const busySlots = await getBusySlots(userId, dayStart, dayEnd);

  // 3b. Add completed local blocks (+ their transport buffers) as busy so the
  //     AI never schedules new tasks during completed work or travel time
  const completedBlocks = await prisma.scheduledBlock.findMany({
    where: { userId, date: targetDate, status: "completed" },
  });
  const completedBusy: BusySlot[] = completedBlocks.map((b) => ({
    start: new Date(new Date(b.startTime).getTime() - (b.transportBefore ?? 0) * 60 * 1000),
    end: new Date(new Date(b.endTime).getTime() + (b.transportAfter ?? 0) * 60 * 1000),
    summary: b.title,
    availability: "busy" as Availability,
  }));

  // 4. Compute free windows
  const rawFreeSlots = computeFreeSlots(
    [...busySlots, ...completedBusy],
    preferences.workStartTime,
    preferences.workEndTime,
    targetDate,
    preferences.timezone
  );

  // Clip slots to "now" when scheduling today — prevents assigning tasks to past times
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const freeSlots = targetDate === todayKey
    ? rawFreeSlots
        .filter((s) => s.end.getTime() > now.getTime())
        .map((s) => {
          if (s.start.getTime() >= now.getTime()) return s;
          const clippedStart = roundUpTo15Min(now);
          return {
            ...s,
            start: clippedStart,
            durationMinutes: Math.round((s.end.getTime() - clippedStart.getTime()) / 60000),
          };
        })
        .filter((s) => s.durationMinutes > 0)
    : rawFreeSlots;

  if (freeSlots.length === 0) {
    return {
      scheduled: 0,
      unscheduled: tasks.length,
      message: "Your calendar is fully booked today. No free slots available.",
    };
  }

  // 5. Try AI scheduling, fall back to local if OpenAI fails
  let parsed: { assignments: { taskId: string; startTime: string; endTime: string }[]; unscheduled: { taskId: string; reason: string }[] };
  let usedLocalFallback = false;

  try {
    const taskDescriptions = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      durationMinutes: t.durationMinutes,
      priority: t.priority,
      energyType: t.energyType,
      preferredTimeWindow: t.preferredTimeWindow,
      deadline: t.deadline ? t.deadline.toISOString().split("T")[0] : null,
    }));

    const freeSlotDescriptions = freeSlots.map((s) => ({
      start: s.start.toTimeString().slice(0, 5),
      end: s.end.toTimeString().slice(0, 5),
      durationMinutes: s.durationMinutes,
      ...(s.allowedEnergy ? { allowedEnergyTypes: s.allowedEnergy } : {}),
    }));

    const systemPrompt = `You are a scheduling AI assistant. Your job is to optimally assign tasks to available time slots for a day.

Rules:
1. ASAP priority tasks must be scheduled immediately (earliest possible slot). HIGH priority tasks are scheduled next.
2. Respect task durations exactly - do not shorten tasks.
3. Place "deep" energy tasks during the deep work window (${preferences.deepWorkStart} - ${preferences.deepWorkEnd}) when possible.
4. Place "light" and "admin" tasks outside the deep work window when possible.
5. Respect preferred time windows: "morning" = before 12:00, "afternoon" = 12:00-17:00, "evening" = after 17:00.
6. Leave ${preferences.breakMinutes} minutes between consecutive tasks.
7. Tasks with earlier deadlines should be prioritized.
8. If a task cannot fit in any available slot, add it to the "unscheduled" list with a reason.
9. Tasks can be split across at most 3 slots, ONLY if absolutely necessary and the task is 60+ minutes. Each chunk must be at least 30 minutes.
10. startTime and endTime must be in HH:mm format (24-hour).
11. Assignments must fall within the provided free slots.
12. Some slots have "allowedEnergyTypes" — only place tasks whose energyType is in that list. Unrestricted slots allow all types.

Respond with valid JSON only.`;

    const userPrompt = `Date: ${targetDate}
Work hours: ${preferences.workStartTime} - ${preferences.workEndTime}
Deep work window: ${preferences.deepWorkStart} - ${preferences.deepWorkEnd}
Break between tasks: ${preferences.breakMinutes} minutes

Available free slots:
${JSON.stringify(freeSlotDescriptions, null, 2)}

Tasks to schedule:
${JSON.stringify(taskDescriptions, null, 2)}

Assign tasks to time slots. Return JSON with this exact structure:
{
  "assignments": [{ "taskId": "...", "startTime": "HH:mm", "endTime": "HH:mm" }],
  "unscheduled": [{ "taskId": "...", "reason": "..." }]
}`;

    const { client, model } = await getOpenAIClient(userId);

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from AI");
    }

    parsed = scheduleResponseSchema.parse(JSON.parse(responseText));
  } catch (aiError: unknown) {
    // Fall back to local deterministic scheduler
    console.error("AI scheduling failed, using local fallback:", aiError);
    parsed = localScheduleDay(tasks, freeSlots, preferences, targetDate);
    usedLocalFallback = true;
  }

  // 6. Delete old scheduled blocks for this day — but KEEP completed ones
  const existingBlocks: ScheduledBlock[] = await prisma.scheduledBlock.findMany({
    where: { userId, date: targetDate, status: { not: "completed" } },
  });

  for (const block of existingBlocks) {
    if (block.googleEventId) {
      try {
        await deleteCalendarEvent(userId, block.googleEventId);
      } catch {
        // Continue even if Google delete fails
      }
    }
  }

  await prisma.scheduledBlock.deleteMany({
    where: { userId, date: targetDate, status: { not: "completed" } },
  });

  // 7. Create new blocks (local only — Google sync happens on task completion)
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  let scheduledCount = 0;

  for (const assignment of parsed.assignments) {
    const task = taskMap.get(assignment.taskId);
    if (!task) continue;

    const startTime = new Date(`${targetDate}T${assignment.startTime}:00`);
    const endTime = new Date(`${targetDate}T${assignment.endTime}:00`);

    // Only create Google events when using AI scheduler (not fallback)
    let googleEventId: string | null = null;
    if (!usedLocalFallback) {
      try {
        googleEventId = await createCalendarEvent(userId, task.title, startTime, endTime);
      } catch {
        // Continue without Google event
      }
    }

    await prisma.scheduledBlock.create({
      data: {
        userId,
        taskId: task.id,
        googleEventId,
        title: task.title,
        startTime,
        endTime,
        date: targetDate,
        color: task.project?.color || getColorForEnergyType(task.energyType),
      },
    });

    scheduledCount++;
  }

  const fallbackNote = usedLocalFallback
    ? " (Scheduled locally — AI unavailable, check your OpenAI billing)"
    : "";

  return {
    scheduled: scheduledCount,
    unscheduled: parsed.unscheduled.length,
    usedLocalFallback,
    message:
      scheduledCount > 0
        ? `Scheduled ${scheduledCount} task${scheduledCount !== 1 ? "s" : ""}.${
            parsed.unscheduled.length > 0
              ? ` ${parsed.unscheduled.length} couldn't fit.`
              : " All tasks placed!"
          }${fallbackNote}`
        : `No tasks could be scheduled in the available slots.${fallbackNote}`,
    unscheduledDetails: parsed.unscheduled.map((u) => ({
      title: taskMap.get(u.taskId)?.title || u.taskId,
      reason: u.reason,
    })),
  };
}
