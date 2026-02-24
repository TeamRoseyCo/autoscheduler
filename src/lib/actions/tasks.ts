"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  deadline: z.string().optional().default(""),
  priority: z.enum(["high", "medium", "low"]),
  energyType: z.enum(["deep", "light", "admin"]),
  preferredTimeWindow: z.string().optional().default(""),
});

export async function getTasks(filter: "active" | "completed" = "active") {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.task.findMany({
    where: {
      userId: session.user.id,
      completed: filter === "completed",
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

  await prisma.task.create({
    data: {
      userId: session.user.id,
      title: data.title,
      durationMinutes: data.durationMinutes,
      deadline: data.deadline ? new Date(data.deadline) : null,
      priority: data.priority,
      energyType: data.energyType,
      preferredTimeWindow: data.preferredTimeWindow || null,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
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

  await prisma.task.update({
    where: { id: taskId },
    data: { completed: !task.completed },
  });

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
