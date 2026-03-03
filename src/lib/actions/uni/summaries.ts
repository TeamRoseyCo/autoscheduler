"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const summarySchema = z.object({
  courseId: z.string().optional(),
  date: z.string(),
  type: z
    .enum(["lecture", "lab", "tutorial"])
    .default("lecture"),
  topics: z.string().optional(),
  summary: z.string().optional(),
  keyTakeaways: z.string().optional(),
  questions: z.string().optional(),
});

export async function getSummaries(courseId?: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const where: any = { userId: session.user.id };
  if (courseId) {
    where.courseId = courseId;
  }

  return prisma.uniClassSummary.findMany({
    where,
    include: { course: true },
    orderBy: { date: "desc" },
  });
}

export async function createSummary(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = summarySchema.parse(raw);

  const summary = await prisma.uniClassSummary.create({
    data: {
      ...data,
      date: new Date(data.date),
      courseId: data.courseId || null,
      userId: session.user.id,
    },
    include: { course: true },
  });

  return summary;
}

export async function updateSummary(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = summarySchema.parse(raw);

  const summary = await prisma.uniClassSummary.update({
    where: { id },
    data: {
      ...data,
      date: new Date(data.date),
      courseId: data.courseId || null,
    },
    include: { course: true },
  });

  return summary;
}

export async function deleteSummary(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  return prisma.uniClassSummary.delete({
    where: { id },
  });
}
