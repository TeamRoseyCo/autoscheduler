"use server";

import { auth } from "@/lib/auth";
import { scheduleDay } from "@/lib/scheduler";
import { revalidatePath } from "next/cache";

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
