"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const courseSchema = z.object({
  semesterId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  professor: z.string().optional(),
  room: z.string().optional(),
  credits: z.coerce.number().optional(),
  color: z.string().default("indigo"),
  status: z.enum(["active", "completed", "dropped"]).default("active"),
  moodleCourseId: z.coerce.number().optional(),
});

export async function getCourses(semesterId?: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const where: any = { userId: session.user.id };
  if (semesterId) {
    where.semesterId = semesterId;
  }

  return prisma.uniCourse.findMany({
    where,
    orderBy: { code: "asc" },
  });
}

export async function createCourse(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = courseSchema.parse(raw);

  const course = await prisma.uniCourse.create({
    data: {
      ...data,
      userId: session.user.id,
    },
  });

  return course;
}

export async function updateCourse(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = courseSchema.parse(raw);

  const course = await prisma.uniCourse.update({
    where: { id },
    data,
  });

  return course;
}

export async function deleteCourse(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const course = await prisma.uniCourse.delete({
    where: { id },
  });

  return course;
}

export async function mergeCourses(sourceId: string, targetId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Verify both courses belong to the user
  const [source, target] = await Promise.all([
    prisma.uniCourse.findFirst({ where: { id: sourceId, userId: session.user.id } }),
    prisma.uniCourse.findFirst({ where: { id: targetId, userId: session.user.id } }),
  ]);
  if (!source || !target) throw new Error("Course not found");

  // Move all related data from source to target
  await prisma.$transaction([
    prisma.uniClassSlot.updateMany({ where: { courseId: sourceId }, data: { courseId: targetId } }),
    prisma.uniExam.updateMany({ where: { courseId: sourceId }, data: { courseId: targetId } }),
    prisma.uniGradeItem.updateMany({ where: { courseId: sourceId }, data: { courseId: targetId } }),
    prisma.uniNote.updateMany({ where: { courseId: sourceId }, data: { courseId: targetId } }),
    prisma.uniClassSummary.updateMany({ where: { courseId: sourceId }, data: { courseId: targetId } }),
    prisma.uniResource.updateMany({ where: { courseId: sourceId }, data: { courseId: targetId } }),
    prisma.uniCourse.delete({ where: { id: sourceId } }),
  ]);
}

export async function getCourseDetail(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.uniCourse.findUnique({
    where: { id },
    include: {
      classSlots: {
        orderBy: { dayOfWeek: "asc" },
      },
      exams: {
        orderBy: { date: "asc" },
      },
      gradeItems: {
        orderBy: { date: "asc" },
      },
      notes: {
        orderBy: { createdAt: "desc" },
      },
      summaries: {
        orderBy: { date: "desc" },
      },
      resources: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
