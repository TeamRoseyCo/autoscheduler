"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const classSlotSchema = z.object({
  courseId: z.string().min(1),
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  type: z.enum(["lecture", "lab", "tutorial", "seminar"]).default("lecture"),
  location: z.string().optional(),
});

export async function getClassSlots(courseId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.uniClassSlot.findMany({
    where: { userId: session.user.id, courseId },
    orderBy: { dayOfWeek: "asc" },
  });
}

export async function getAllClassSlots() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.uniClassSlot.findMany({
    where: { userId: session.user.id },
    orderBy: { dayOfWeek: "asc" },
  });
}

export async function createClassSlot(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = classSlotSchema.parse(raw);

  const slot = await prisma.uniClassSlot.create({
    data: {
      ...data,
      userId: session.user.id,
    },
  });

  return slot;
}

export async function updateClassSlot(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = classSlotSchema.parse(raw);

  const slot = await prisma.uniClassSlot.update({
    where: { id },
    data,
  });

  return slot;
}

export async function deleteClassSlot(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const slot = await prisma.uniClassSlot.delete({
    where: { id },
  });

  return slot;
}
