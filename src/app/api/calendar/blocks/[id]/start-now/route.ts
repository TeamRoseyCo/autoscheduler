import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findNextFreeSlot } from "@/lib/local-scheduler";

function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const block = await prisma.scheduledBlock.findUnique({
      where: { id, userId: session.user.id },
      include: { task: true },
    });

    if (!block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    const now = new Date();
    const durationMs =
      new Date(block.endTime).getTime() - new Date(block.startTime).getTime();
    const newEndTime = new Date(now.getTime() + durationMs);
    const todayKey = dateToKey(now);

    // 1. Move the block to start right now
    await prisma.scheduledBlock.update({
      where: { id },
      data: {
        startTime: now,
        endTime: newEndTime,
        date: todayKey,
        status: "in_progress",
        actualStartTime: now,
      },
    });

    // 2. Find all other scheduled blocks that now overlap with [now, newEndTime]
    const conflicting = await prisma.scheduledBlock.findMany({
      where: {
        userId: session.user.id,
        id: { not: id },
        status: "scheduled",
        startTime: { lt: newEndTime },
        endTime: { gt: now },
      },
      include: { task: true },
      orderBy: { startTime: "asc" },
    });

    // 3. Reschedule each conflicting block to the next free slot
    // (The start-now block is already saved, so findNextFreeSlot will skip its time)
    let rescheduledCount = 0;
    for (const conflict of conflicting) {
      const conflictDurationMs =
        new Date(conflict.endTime).getTime() - new Date(conflict.startTime).getTime();
      const conflictDurationMinutes = Math.round(conflictDurationMs / 60000);

      const slot = await findNextFreeSlot(
        session.user.id,
        conflictDurationMinutes,
        conflict.task?.preferredTimeWindow,
        conflict.task?.energyType
      );

      if (!slot) continue;

      await prisma.scheduledBlock.update({
        where: { id: conflict.id },
        data: {
          startTime: slot.startTime,
          endTime: slot.endTime,
          date: slot.date,
        },
      });

      rescheduledCount++;
    }

    return NextResponse.json({ success: true, rescheduled: rescheduledCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start task";
    console.error("Start-now error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
