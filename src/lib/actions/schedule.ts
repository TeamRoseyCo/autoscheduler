"use server";

import { auth } from "@/lib/auth";
import { scheduleDay } from "@/lib/scheduler";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

type BlockSnapshot = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  color: string;
  availability?: string;
  taskId?: string;
  status?: string;
  location?: string | null;
  transportBefore?: number | null;
  transportAfter?: number | null;
  transportMode?: string | null;
};

export async function scheduleTodayAction() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const today = new Date().toISOString().split("T")[0];
  const result = await scheduleDay(session.user.id, today);

  revalidatePath("/");
  return result;
}

export async function scheduleDateAction(date: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const result = await scheduleDay(session.user.id, date);

  revalidatePath("/");
  return result;
}

export async function restoreScheduleAction(snapshot: BlockSnapshot[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  if (!snapshot.length) return;

  const date = snapshot[0].date;

  // Remove whatever the scheduler created for that day
  await prisma.scheduledBlock.deleteMany({
    where: { userId: session.user.id, date },
  });

  // Recreate the original blocks
  await prisma.scheduledBlock.createMany({
    data: snapshot.map((b) => ({
      userId: session.user.id,
      title: b.title,
      date: b.date,
      startTime: new Date(b.startTime),
      endTime: new Date(b.endTime),
      color: b.color || "indigo",
      availability: b.availability || "busy",
      taskId: b.taskId ?? null,
      status: b.status || "scheduled",
      location: b.location ?? null,
      transportBefore: b.transportBefore ?? null,
      transportAfter: b.transportAfter ?? null,
      transportMode: b.transportMode ?? null,
    })),
  });

  revalidatePath("/");
}
