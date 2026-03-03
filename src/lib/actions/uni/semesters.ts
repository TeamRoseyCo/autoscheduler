"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const semesterSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean().default(false),
});

export async function getSemesters() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.uniSemester.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "desc" },
  });
}

export async function createSemester(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = semesterSchema.parse(raw);

  // If setting as current, unset others
  if (data.isCurrent) {
    await prisma.uniSemester.updateMany({
      where: { userId: session.user.id, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  const semester = await prisma.uniSemester.create({
    data: {
      ...data,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      userId: session.user.id,
    },
  });

  return semester;
}

export async function updateSemester(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = semesterSchema.parse(raw);

  // If setting as current, unset others
  if (data.isCurrent) {
    await prisma.uniSemester.updateMany({
      where: { userId: session.user.id, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  const semester = await prisma.uniSemester.update({
    where: { id },
    data: {
      ...data,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    },
  });

  return semester;
}

export async function deleteSemester(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const semester = await prisma.uniSemester.delete({
    where: { id },
  });

  return semester;
}

export async function setCurrentSemester(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Unset all others
  await prisma.uniSemester.updateMany({
    where: { userId: session.user.id, isCurrent: true },
    data: { isCurrent: false },
  });

  // Set this one as current
  const semester = await prisma.uniSemester.update({
    where: { id },
    data: { isCurrent: true },
  });

  return semester;
}
