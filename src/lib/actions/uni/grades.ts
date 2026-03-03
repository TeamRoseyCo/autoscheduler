"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const gradeItemSchema = z.object({
  courseId: z.string().optional(),
  name: z.string().min(1),
  category: z.string().optional(),
  weight: z.coerce.number().optional(),
  maxScore: z.coerce.number().min(0),
  score: z.coerce.number().min(0).optional(),
  date: z.string().optional(),
});

export async function getGradeItems(courseId?: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const where: any = { userId: session.user.id };
  if (courseId) {
    where.courseId = courseId;
  }

  return prisma.uniGradeItem.findMany({
    where,
    include: { course: true },
    orderBy: { date: "desc" },
  });
}

export async function createGradeItem(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = gradeItemSchema.parse(raw);

  const gradeItem = await prisma.uniGradeItem.create({
    data: {
      ...data,
      date: data.date ? new Date(data.date) : null,
      userId: session.user.id,
    },
    include: { course: true },
  });

  return gradeItem;
}

export async function updateGradeItem(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = gradeItemSchema.parse(raw);

  const gradeItem = await prisma.uniGradeItem.update({
    where: { id },
    data: {
      ...data,
      date: data.date ? new Date(data.date) : null,
    },
    include: { course: true },
  });

  return gradeItem;
}

export async function deleteGradeItem(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  return prisma.uniGradeItem.delete({
    where: { id },
  });
}
