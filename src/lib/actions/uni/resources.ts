"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const resourceSchema = z.object({
  courseId: z.string().optional(),
  title: z.string().min(1),
  url: z.string().optional(),
  type: z
    .enum(["link", "file", "textbook", "video", "website"])
    .default("link"),
  category: z.string().optional(),
  notes: z.string().optional(),
  starred: z.boolean().default(false),
});

export async function getResources(filters?: {
  courseId?: string;
  starred?: boolean;
  type?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const where: any = { userId: session.user.id };
  if (filters?.courseId) {
    where.courseId = filters.courseId;
  }
  if (filters?.starred !== undefined) {
    where.starred = filters.starred;
  }
  if (filters?.type) {
    where.type = filters.type;
  }

  return prisma.uniResource.findMany({
    where,
    include: { course: true },
    orderBy: [{ starred: "desc" }, { createdAt: "desc" }],
  });
}

export async function createResource(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = resourceSchema.parse(raw);

  const resource = await prisma.uniResource.create({
    data: {
      ...data,
      courseId: data.courseId || null,
      userId: session.user.id,
    },
    include: { course: true },
  });

  return resource;
}

export async function updateResource(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = resourceSchema.parse(raw);

  const resource = await prisma.uniResource.update({
    where: { id },
    data: {
      ...data,
      courseId: data.courseId || null,
    },
    include: { course: true },
  });

  return resource;
}

export async function deleteResource(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  return prisma.uniResource.delete({
    where: { id },
  });
}

export async function toggleStarResource(id: string, starred: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  return prisma.uniResource.update({
    where: { id },
    data: { starred },
  });
}
