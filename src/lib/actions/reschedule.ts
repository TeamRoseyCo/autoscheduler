"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { findNextFreeSlot } from "@/lib/local-scheduler";
import { getColorForEnergyType } from "@/lib/utils";

/**
 * Find all scheduled blocks where endTime is in the past and the associated
 * task is not completed. Move them forward to the next available free slot.
 */
export async function rescheduleOverdueTasks(userId: string) {
  const now = new Date();

  // Find overdue blocks: endTime < now, task not completed, only scheduled status
  const overdueBlocks = await prisma.scheduledBlock.findMany({
    where: {
      userId,
      endTime: { lt: now },
      status: "scheduled",
      task: {
        completed: false,
      },
    },
    include: {
      task: {
        include: { project: { select: { color: true } } },
      },
    },
    orderBy: { startTime: "asc" },
  });

  let rescheduledCount = 0;

  for (const block of overdueBlocks) {
    if (!block.task) continue;

    const durationMs = new Date(block.endTime).getTime() - new Date(block.startTime).getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    const slot = await findNextFreeSlot(
      userId,
      durationMinutes,
      block.task.preferredTimeWindow,
      block.task.energyType
    );

    if (!slot) continue;

    await prisma.scheduledBlock.update({
      where: { id: block.id },
      data: {
        startTime: slot.startTime,
        endTime: slot.endTime,
        date: slot.date,
      },
    });

    rescheduledCount++;
  }

  return {
    rescheduled: rescheduledCount,
    total: overdueBlocks.length,
  };
}

/**
 * Reschedule a specific block to the next available free slot.
 * Deletes the current block and creates a new one at the next free time.
 */
export async function rescheduleBlockForLater(
  blockId: string,
  when: "sooner" | "today" | "this_week" | "this_month" = "this_week"
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const block = await prisma.scheduledBlock.findUnique({
    where: { id: blockId, userId: session.user.id },
    include: {
      task: {
        include: { project: { select: { color: true } } },
      },
    },
  });

  if (!block) throw new Error("Block not found");

  const durationMs = new Date(block.endTime).getTime() - new Date(block.startTime).getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  const now = new Date();

  // Compute searchFrom and maxDays based on `when`
  let searchFrom: Date;
  let maxDays: number;
  let label: string;

  if (when === "sooner") {
    // Find the earliest available slot from now
    searchFrom = now;
    maxDays = 7;
    label = "the next 7 days";
  } else if (when === "today") {
    // Later today — search from after the block's end, only today
    searchFrom = new Date(Math.max(block.endTime.getTime(), now.getTime()));
    maxDays = 1;
    label = "today";
  } else if (when === "this_week") {
    // Last 3 days of the coming week (days 5-7 from now)
    const start = new Date(now);
    start.setDate(start.getDate() + 4);
    start.setHours(0, 0, 0, 0);
    searchFrom = start;
    maxDays = 3;
    label = "this week";
  } else {
    // Last week of the month (days 23-30 from now)
    const start = new Date(now);
    start.setDate(start.getDate() + 23);
    start.setHours(0, 0, 0, 0);
    searchFrom = start;
    maxDays = 7;
    label = "this month";
  }

  // Delete the current block first so its time slot becomes free
  await prisma.scheduledBlock.delete({ where: { id: blockId } });

  // Find the next free slot within the requested range
  const slot = await findNextFreeSlot(
    session.user.id,
    durationMinutes,
    block.task?.preferredTimeWindow,
    block.task?.energyType,
    searchFrom,
    maxDays
  );

  if (!slot) {
    return { success: false, message: `No available slot found ${label}` };
  }

  // Create a new block at the found slot
  await prisma.scheduledBlock.create({
    data: {
      userId: session.user.id,
      taskId: block.taskId,
      title: block.title,
      startTime: slot.startTime,
      endTime: slot.endTime,
      date: slot.date,
      color: block.task?.project?.color || (block.task ? getColorForEnergyType(block.task.energyType) : block.color),
    },
  });

  return { success: true, date: slot.date };
}
