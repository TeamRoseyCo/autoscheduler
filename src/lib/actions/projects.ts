"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const projectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().default(""),
  color: z.string().optional().default("indigo"),
  deadline: z.string().optional().default(""),
});

export async function getProjects() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    include: {
      tasks: {
        select: { id: true, completed: true },
      },
      habits: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    color: p.color,
    status: p.status,
    deadline: p.deadline,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    taskCount: p.tasks.length,
    completedCount: p.tasks.filter((t) => t.completed).length,
    habitCount: p.habits.length,
  }));
}

export type ProjectWithCounts = Awaited<ReturnType<typeof getProjects>>[number];

export async function getProject(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.project.findUnique({
    where: { id, userId: session.user.id },
    include: { tasks: { orderBy: { createdAt: "desc" } } },
  });
}

export async function createProject(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = projectSchema.parse(raw);

  await prisma.project.create({
    data: {
      userId: session.user.id,
      name: data.name,
      description: data.description || null,
      color: data.color,
      deadline: data.deadline ? new Date(data.deadline) : null,
    },
  });

  revalidatePath("/");
  revalidatePath("/tasks");
}

export async function updateProject(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = projectSchema.parse(raw);

  await prisma.project.update({
    where: { id, userId: session.user.id },
    data: {
      name: data.name,
      description: data.description || null,
      color: data.color,
      deadline: data.deadline ? new Date(data.deadline) : null,
    },
  });

  revalidatePath("/");
  revalidatePath("/tasks");
}

export async function deleteProject(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.project.delete({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/");
  revalidatePath("/tasks");
}

export async function createProjectWithTasks(data: {
  name: string;
  description: string;
  color: string;
  deadline?: string;
  tasks: {
    title: string;
    durationMinutes: number;
    priority: string;
    energyType: string;
  }[];
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        userId: session.user!.id!,
        name: data.name,
        description: data.description || null,
        color: data.color,
        deadline: data.deadline ? new Date(data.deadline) : null,
      },
    });

    for (const task of data.tasks) {
      await tx.task.create({
        data: {
          userId: session.user!.id!,
          projectId: project.id,
          title: task.title,
          durationMinutes: task.durationMinutes,
          priority: task.priority,
          energyType: task.energyType,
        },
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/tasks");
}
