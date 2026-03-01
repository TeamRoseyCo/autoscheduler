"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const preferencesSchema = z.object({
  workStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  workEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  workDays: z.string(),
  deepWorkStart: z.string().regex(/^\d{2}:\d{2}$/),
  deepWorkEnd: z.string().regex(/^\d{2}:\d{2}$/),
  breakMinutes: z.coerce.number().int().min(0).max(60),
  timezone: z.string().min(1),
  aiProvider: z.string().min(1).default("gemini"),
  openaiApiKey: z.string().optional().default(""),
  openaiModel: z.string().min(1),
  googleMapsApiKey: z.string().optional().default(""),
  savedPlaces: z.string().optional().default("[]"),
});

export async function getPreferences() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.preferences.findUnique({
    where: { userId: session.user.id },
  });
}

export async function savePreferences(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = preferencesSchema.parse(raw);

  await prisma.preferences.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  return { success: true };
}
