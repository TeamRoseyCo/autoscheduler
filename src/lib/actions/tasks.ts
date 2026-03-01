"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { autoScheduleTask } from "@/lib/local-scheduler";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  deadline: z.string().optional().default(""),
  priority: z.enum(["asap", "high", "medium", "low"]),
  energyType: z.enum(["deep", "light", "admin"]),
  preferredTimeWindow: z.string().optional().default(""),
  projectId: z.string().optional().default(""),
  metricId: z.string().optional().default(""),
  taskStatus: z.enum(["todo", "in_progress", "completed", "cancelled", "blocked"]).optional().default("todo"),
});

export async function getTasks(filter: "active" | "completed" = "active") {
  const session = await auth();
  if (!session?.user?.id) return [];

  const doneStatuses = ["completed", "cancelled"];

  return prisma.task.findMany({
    where: {
      userId: session.user.id,
      taskStatus: filter === "completed"
        ? { in: doneStatuses }
        : { notIn: doneStatuses },
    },
    include: {
      project: {
        select: { id: true, name: true, color: true },
      },
      metric: {
        select: { id: true, name: true, unit: true, icon: true },
      },
    },
    orderBy: [
      { priority: "asc" }, // high sorts first alphabetically
      { deadline: "asc" },
      { createdAt: "desc" },
    ],
  });
}

export async function createTask(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = taskSchema.parse(raw);

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: data.title,
      durationMinutes: data.durationMinutes,
      deadline: data.deadline ? new Date(data.deadline) : null,
      priority: data.priority,
      energyType: data.energyType,
      preferredTimeWindow: data.preferredTimeWindow || null,
      projectId: data.projectId || null,
      metricId: data.metricId || null,
      taskStatus: data.taskStatus,
      completed: data.taskStatus === "completed" || data.taskStatus === "cancelled",
    },
  });

  // Auto-schedule the task on the calendar (local only, no Google event)
  try {
    await autoScheduleTask(session.user.id, task.id);
  } catch (err) {
    console.error("Auto-schedule failed (non-blocking):", err);
  }

  revalidatePath("/tasks");
  revalidatePath("/");

  return task.id;
}

export async function updateTask(taskId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = taskSchema.parse(raw);

  await prisma.task.update({
    where: { id: taskId, userId: session.user.id },
    data: {
      title: data.title,
      durationMinutes: data.durationMinutes,
      deadline: data.deadline ? new Date(data.deadline) : null,
      priority: data.priority,
      energyType: data.energyType,
      preferredTimeWindow: data.preferredTimeWindow || null,
      projectId: data.projectId || null,
      metricId: data.metricId || null,
      taskStatus: data.taskStatus,
      completed: data.taskStatus === "completed" || data.taskStatus === "cancelled",
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function toggleTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const task = await prisma.task.findUnique({
    where: { id: taskId, userId: session.user.id },
  });
  if (!task) throw new Error("Task not found");

  const newStatus = task.taskStatus === "completed" ? "todo" : "completed";
  await setTaskStatus(taskId, newStatus as "todo" | "in_progress" | "completed" | "cancelled" | "blocked");
}

export async function setTaskStatus(
  taskId: string,
  status: "todo" | "in_progress" | "completed" | "cancelled" | "blocked"
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const isDone = status === "completed" || status === "cancelled";

  await prisma.task.update({
    where: { id: taskId, userId: session.user.id },
    data: { taskStatus: status, completed: isDone },
  });

  // When marking as completed, sync to Google Calendar.
  // Store the googleEventId on the block so mergeEvents can adopt Google styling for it.
  if (status === "completed") {
    try {
      const block = await prisma.scheduledBlock.findFirst({
        where: { taskId, userId: session.user.id },
      });

      if (block) {
        // Remove any stale Google event first
        if (block.googleEventId) {
          try {
            await deleteCalendarEvent(session.user.id, block.googleEventId);
          } catch {
            // Ignore — may have been deleted externally
          }
        }

        const googleEventId = await createCalendarEvent(
          session.user.id,
          block.title,
          new Date(block.startTime),
          new Date(block.endTime)
        );

        await prisma.scheduledBlock.update({
          where: { id: block.id },
          data: { googleEventId },
        });
      }
    } catch (err) {
      console.error("Google Calendar sync on completion failed (non-blocking):", err);
    }
  }

  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function deleteTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.task.delete({
    where: { id: taskId, userId: session.user.id },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
}
