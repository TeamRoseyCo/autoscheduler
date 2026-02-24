import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai";
import {
  getBusySlots,
  computeFreeSlots,
  createCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";
import { getColorForEnergyType } from "@/lib/utils";
import { z } from "zod/v4";
import type { Task, ScheduledBlock, Preferences } from "@/generated/prisma/client";

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

export async function scheduleDay(userId: string, targetDate: string) {
  // 1. Load preferences
  const preferences = await prisma.preferences.findUnique({
    where: { userId },
  }) as Preferences | null;
  if (!preferences) {
    throw new Error("Please configure your preferences in Settings first.");
  }

  // 2. Load incomplete tasks
  const tasks: Task[] = await prisma.task.findMany({
    where: { userId, completed: false },
    orderBy: [{ priority: "asc" }, { deadline: "asc" }],
  });

  if (tasks.length === 0) {
    return { scheduled: 0, unscheduled: 0, message: "No active tasks to schedule." };
  }

  // 3. Fetch busy slots from Google Calendar
  const dayStart = new Date(`${targetDate}T00:00:00`);
  const dayEnd = new Date(`${targetDate}T23:59:59`);
  const busySlots = await getBusySlots(userId, dayStart, dayEnd);

  // 4. Compute free windows
  const freeSlots = computeFreeSlots(
    busySlots,
    preferences.workStartTime,
    preferences.workEndTime,
    targetDate,
    preferences.timezone
  );

  if (freeSlots.length === 0) {
    return {
      scheduled: 0,
      unscheduled: tasks.length,
      message: "Your calendar is fully booked today. No free slots available.",
    };
  }

  // 5. Build prompt
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
  }));

  const systemPrompt = `You are a scheduling AI assistant. Your job is to optimally assign tasks to available time slots for a day.

Rules:
1. HIGH priority tasks must be scheduled first.
2. Respect task durations exactly - do not shorten tasks.
3. Place "deep" energy tasks during the deep work window (${preferences.deepWorkStart} - ${preferences.deepWorkEnd}) when possible.
4. Place "light" and "admin" tasks outside the deep work window when possible.
5. Respect preferred time windows: "morning" = before 12:00, "afternoon" = 12:00-17:00, "evening" = after 17:00.
6. Leave ${preferences.breakMinutes} minutes between consecutive tasks.
7. Tasks with earlier deadlines should be prioritized.
8. If a task cannot fit in any available slot, add it to the "unscheduled" list with a reason.
9. Tasks can be split across multiple slots ONLY if absolutely necessary and the task is 60+ minutes.
10. startTime and endTime must be in HH:mm format (24-hour).
11. Assignments must fall within the provided free slots.

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

  // 6. Call OpenAI
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
    throw new Error("No response from AI. Please try again.");
  }

  // 7. Parse response
  let parsed;
  try {
    parsed = scheduleResponseSchema.parse(JSON.parse(responseText));
  } catch {
    throw new Error(
      "AI returned an invalid schedule format. Please try again."
    );
  }

  // 8. Delete old AI-scheduled blocks for this day
  const existingBlocks: ScheduledBlock[] = await prisma.scheduledBlock.findMany({
    where: { userId, date: targetDate },
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
    where: { userId, date: targetDate },
  });

  // 9. Create new calendar events + DB records
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  let scheduledCount = 0;

  for (const assignment of parsed.assignments) {
    const task = taskMap.get(assignment.taskId);
    if (!task) continue;

    const startTime = new Date(`${targetDate}T${assignment.startTime}:00`);
    const endTime = new Date(`${targetDate}T${assignment.endTime}:00`);

    const googleEventId = await createCalendarEvent(
      userId,
      task.title,
      startTime,
      endTime
    );

    await prisma.scheduledBlock.create({
      data: {
        userId,
        taskId: task.id,
        googleEventId,
        title: task.title,
        startTime,
        endTime,
        date: targetDate,
        color: getColorForEnergyType(task.energyType),
      },
    });

    scheduledCount++;
  }

  return {
    scheduled: scheduledCount,
    unscheduled: parsed.unscheduled.length,
    message:
      scheduledCount > 0
        ? `Scheduled ${scheduledCount} task${scheduledCount !== 1 ? "s" : ""}. ${
            parsed.unscheduled.length > 0
              ? `${parsed.unscheduled.length} couldn't fit.`
              : "All tasks placed!"
          }`
        : "No tasks could be scheduled in the available slots.",
    unscheduledDetails: parsed.unscheduled.map((u) => ({
      title: taskMap.get(u.taskId)?.title || u.taskId,
      reason: u.reason,
    })),
  };
}
