import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findNextFreeSlot } from "@/lib/local-scheduler";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { remainingMinutes } = body;

    if (!remainingMinutes || remainingMinutes <= 0) {
      return NextResponse.json({ error: "remainingMinutes must be positive" }, { status: 400 });
    }

    // Look up original block
    const original = await prisma.scheduledBlock.findUnique({
      where: { id, userId: session.user.id },
      include: {
        task: {
          select: { id: true, preferredTimeWindow: true, energyType: true },
        },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    // Find next free slot
    const slot = await findNextFreeSlot(
      session.user.id,
      remainingMinutes,
      original.task?.preferredTimeWindow,
      original.task?.energyType
    );

    if (!slot) {
      return NextResponse.json({ error: "No available slot found" }, { status: 404 });
    }

    // Create new block for remaining time
    const newBlock = await prisma.scheduledBlock.create({
      data: {
        userId: session.user.id,
        taskId: original.taskId,
        title: original.title,
        startTime: slot.startTime,
        endTime: slot.endTime,
        date: slot.date,
        color: original.color,
      },
    });

    return NextResponse.json(newBlock);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reschedule remaining";
    console.error("Reschedule remaining error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
