"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const noteSchema = z.object({
  courseId: z.string().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.string().optional(),
  pinned: z.boolean().default(false),
});

export async function getNotes(filters?: { courseId?: string; pinned?: boolean }) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const where: any = { userId: session.user.id };
  if (filters?.courseId) {
    where.courseId = filters.courseId;
  }
  if (filters?.pinned !== undefined) {
    where.pinned = filters.pinned;
  }

  return prisma.uniNote.findMany({
    where,
    include: { course: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
}

export async function createNote(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = noteSchema.parse(raw);

  const note = await prisma.uniNote.create({
    data: {
      ...data,
      courseId: data.courseId || null,
      userId: session.user.id,
    },
    include: { course: true },
  });

  return note;
}

export async function updateNote(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = noteSchema.parse(raw);

  const note = await prisma.uniNote.update({
    where: { id },
    data: {
      ...data,
      courseId: data.courseId || null,
    },
    include: { course: true },
  });

  return note;
}

export async function deleteNote(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  return prisma.uniNote.delete({
    where: { id },
  });
}
