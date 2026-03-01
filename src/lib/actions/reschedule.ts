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
export async function rescheduleBlockForLater(blockId: string) {
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

  // Delete the current block first so its time slot becomes free
  await prisma.scheduledBlock.delete({ where: { id: blockId } });

  // Find the next free slot
  const slot = await findNextFreeSlot(
    session.user.id,
    durationMinutes,
    block.task?.preferredTimeWindow,
    block.task?.energyType
  );

  if (!slot) {
    return { success: false, message: "No available slot found in the next 7 days" };
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
