import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";
import { revalidatePath } from "next/cache";

export async function PATCH(
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

    // Verify the block belongs to this user
    const existing = await prisma.scheduledBlock.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    // Enforce lock: only allow unlocking (locked=false) when the block is locked
    if (existing.locked && body.locked !== false) {
      return NextResponse.json({ error: "Event is locked. Unlock it first to make changes." }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.startTime) {
      updateData.startTime = new Date(body.startTime);
    }
    if (body.endTime) {
      updateData.endTime = new Date(body.endTime);
    }
    if (body.date) {
      updateData.date = body.date;
    }
    if (body.title !== undefined) {
      updateData.title = body.title;
    }
    if (body.color !== undefined) {
      updateData.color = body.color;
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.availability !== undefined) {
      updateData.availability = body.availability;
    }
    if (body.actualStartTime !== undefined) {
      updateData.actualStartTime = body.actualStartTime ? new Date(body.actualStartTime) : null;
    }
    if (body.actualEndTime !== undefined) {
      updateData.actualEndTime = body.actualEndTime ? new Date(body.actualEndTime) : null;
    }
    if (body.location !== undefined) {
      updateData.location = body.location || null;
    }
    if (body.transportBefore !== undefined) {
      updateData.transportBefore = body.transportBefore ?? null;
    }
    if (body.transportAfter !== undefined) {
      updateData.transportAfter = body.transportAfter ?? null;
    }
    if (body.transportMode !== undefined) {
      updateData.transportMode = body.transportMode || null;
    }
    if (body.locked !== undefined) {
      updateData.locked = Boolean(body.locked);
    }

    const updated = await prisma.scheduledBlock.update({
      where: { id },
      data: updateData,
    });

    // When un-completing (scheduled/in_progress), remove the completion Google event
    if (
      body.status &&
      body.status !== "completed" &&
      existing.status === "completed" &&
      existing.googleEventId
    ) {
      try {
        await deleteCalendarEvent(session.user.id, existing.googleEventId);
        updateData.googleEventId = null;
      } catch {
        // Ignore — may have been deleted externally
      }
    }

    // Auto-lock when marking as completed
    if (body.status === "completed") {
      await prisma.scheduledBlock.update({
        where: { id },
        data: { locked: true },
      });
    }

    // When marking as completed, sync to Google Calendar with the actual times.
    // Store the googleEventId on the block so mergeEvents can adopt Google styling for it.
    if (body.status === "completed") {
      try {
        const startTime = updateData.actualStartTime instanceof Date
          ? updateData.actualStartTime
          : updateData.startTime instanceof Date
            ? updateData.startTime
            : new Date(existing.startTime);
        const endTime = updateData.actualEndTime instanceof Date
          ? updateData.actualEndTime
          : updateData.endTime instanceof Date
            ? updateData.endTime
            : new Date(existing.endTime);

        // Remove any stale Google event first (e.g. from AI scheduling at the old time)
        if (existing.googleEventId) {
          try {
            await deleteCalendarEvent(session.user.id, existing.googleEventId);
          } catch {
            // Ignore — may have been deleted externally
          }
        }

        const googleEventId = await createCalendarEvent(
          session.user.id,
          existing.title,
          startTime,
          endTime
        );

        await prisma.scheduledBlock.update({
          where: { id },
          data: { googleEventId },
        });
      } catch (err) {
        console.error("Google Calendar sync on completion failed (non-blocking):", err);
      }
    }

    // Cascade block status to the linked task
    if (body.status !== undefined && existing.taskId) {
      if (body.status === "completed") {
        await prisma.task.update({
          where: { id: existing.taskId, userId: session.user.id },
          data: { taskStatus: "completed", completed: true },
        });
        revalidatePath("/tasks");
        revalidatePath("/");
      } else if (body.status === "in_progress" && existing.status !== "in_progress") {
        await prisma.task.update({
          where: { id: existing.taskId, userId: session.user.id },
          data: { taskStatus: "in_progress", completed: false },
        });
        revalidatePath("/tasks");
        revalidatePath("/");
      } else if (body.status === "scheduled" && existing.status === "completed") {
        // Un-completing a block: revert task back to todo
        await prisma.task.update({
          where: { id: existing.taskId, userId: session.user.id },
          data: { taskStatus: "todo", completed: false },
        });
        revalidatePath("/tasks");
        revalidatePath("/");
      }
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update block";
    console.error("Update block error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.scheduledBlock.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    if (existing.locked) {
      return NextResponse.json({ error: "Event is locked. Unlock it first to delete." }, { status: 403 });
    }

    // If synced to Google Calendar, delete the Google event too
    if (existing.googleEventId) {
      try {
        await deleteCalendarEvent(session.user.id, existing.googleEventId);
      } catch {
        // Ignore — may have already been deleted on Google
      }
    }

    await prisma.scheduledBlock.delete({
      where: { id },
    });

    // If this block was linked to a task, delete the task too
    if (existing.taskId) {
      await prisma.task.delete({
        where: { id: existing.taskId, userId: session.user.id },
      });
      revalidatePath("/tasks");
      revalidatePath("/");
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete block";
    console.error("Delete block error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
