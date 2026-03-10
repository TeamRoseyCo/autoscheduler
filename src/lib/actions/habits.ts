"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { autoScheduleTask, rescheduleAllTasks } from "@/lib/local-scheduler";
import { getColorForEnergyType } from "@/lib/utils";

const habitSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  emoji: z.string().optional().default("🔄"),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  frequency: z.string().min(1),
  projectId: z.string().optional().default(""),
  preferredTime: z.string().optional().default(""),
  energyType: z.enum(["deep", "light", "admin"]),
});

export async function getHabits() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.habit.findMany({
    where: { userId: session.user.id },
    include: {
      project: { select: { id: true, name: true, color: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type HabitWithProject = Awaited<ReturnType<typeof getHabits>>[number];

export async function createHabit(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = habitSchema.parse(raw);

  await prisma.habit.create({
    data: {
      userId: session.user.id,
      title: data.title,
      emoji: data.emoji || "🔄",
      durationMinutes: data.durationMinutes,
      frequency: data.frequency,
      projectId: data.projectId || null,
      preferredTime: data.preferredTime || null,
      energyType: data.energyType,
    },
  });

  revalidatePath("/habits");
  revalidatePath("/");
}

export async function updateHabit(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = habitSchema.parse(raw);

  await prisma.habit.update({
    where: { id, userId: session.user.id },
    data: {
      title: data.title,
      emoji: data.emoji || "🔄",
      durationMinutes: data.durationMinutes,
      frequency: data.frequency,
      projectId: data.projectId || null,
      preferredTime: data.preferredTime || null,
      energyType: data.energyType,
    },
  });

  revalidatePath("/habits");
}

export async function deleteHabit(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.habit.delete({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/habits");
}

export async function toggleHabitActive(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const habit = await prisma.habit.findUnique({
    where: { id, userId: session.user.id },
  });
  if (!habit) throw new Error("Habit not found");

  await prisma.habit.update({
    where: { id },
    data: { active: !habit.active },
  });

  revalidatePath("/habits");
}

/** Get Monday of the current week (or specified date's week) */
function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Compute which days of the week a habit applies to */
function getHabitDays(frequency: string): number[] {
  if (frequency === "daily") return [0, 1, 2, 3, 4, 5, 6];
  if (frequency === "weekdays") return [1, 2, 3, 4, 5];
  // CSV day numbers like "1,3,5"
  return frequency.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
}

export async function generateHabitsForWeek(weekStartInput?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const weekStart = weekStartInput || getMonday(new Date());

  const habits = await prisma.habit.findMany({
    where: { userId: session.user.id, active: true },
    include: { project: { select: { color: true } } },
  });

  let created = 0;

  for (const habit of habits) {
    const days = getHabitDays(habit.frequency);

    for (const dayNum of days) {
      const monday = new Date(weekStart + "T00:00:00");
      const offset = dayNum === 0 ? 6 : dayNum - 1;
      const targetDate = new Date(monday);
      targetDate.setDate(monday.getDate() + offset);
      const dateKey = formatDate(targetDate);

      // Skip if already generated for this habit+date
      const existing = await prisma.habitGeneration.findUnique({
        where: { habitId_date: { habitId: habit.id, date: dateKey } },
      });
      if (existing) continue;

      // Create a Task — deadline pins it to that specific day
      const task = await prisma.task.create({
        data: {
          userId: session.user.id,
          title: `${habit.emoji} ${habit.title}`,
          durationMinutes: habit.durationMinutes,
          deadline: new Date(dateKey + "T23:59:59"),
          priority: "medium",
          energyType: habit.energyType,
          preferredTimeWindow: habit.preferredTime || null,
          projectId: habit.projectId || null,
        },
      });

      // Create HabitGeneration record
      await prisma.habitGeneration.create({
        data: {
          userId: session.user.id,
          habitId: habit.id,
          taskId: task.id,
          weekStart,
          date: dateKey,
        },
      });

      created++;
    }
  }

  // Reschedule all pending tasks in priority order so habit tasks and existing
  // tasks compete fairly for the best time slots
  if (created > 0) {
    try {
      await rescheduleAllTasks(session.user.id);
    } catch (err) {
      console.error("Bulk reschedule after habit generation failed:", err);
    }
  }

  revalidatePath("/habits");
  revalidatePath("/tasks");
  revalidatePath("/");

  return created;
}

export async function getWeekReview(weekStartInput?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const weekStart = weekStartInput || getMonday(new Date());

  const generations = await prisma.habitGeneration.findMany({
    where: { userId: session.user.id, weekStart },
  });

  // Fetch associated tasks and habits
  const taskIds = generations.map((g) => g.taskId);
  const habitIds = [...new Set(generations.map((g) => g.habitId))];

  const [tasks, habits] = await Promise.all([
    prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, title: true, completed: true, taskStatus: true },
    }),
    prisma.habit.findMany({
      where: { id: { in: habitIds } },
      select: { id: true, title: true },
    }),
  ]);

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const habitMap = new Map(habits.map((h) => [h.id, h]));

  return generations.map((g) => ({
    id: g.id,
    habitId: g.habitId,
    habitTitle: habitMap.get(g.habitId)?.title || "Unknown",
    taskId: g.taskId,
    date: g.date,
    status: g.status,
    taskCompleted: taskMap.get(g.taskId)?.completed || false,
    taskStatus: taskMap.get(g.taskId)?.taskStatus || "todo",
  }));
}

export async function getPreviousWeekReview() {
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  // Go back one week
  monday.setDate(monday.getDate() - 7);
  const prevWeekStart = formatDate(monday);

  return getWeekReview(prevWeekStart);
}

export async function resolveHabitInstance(
  generationId: string,
  action: "skip" | "reschedule" | "delete"
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const gen = await prisma.habitGeneration.findFirst({
    where: { id: generationId, userId: session.user.id },
  });
  if (!gen) throw new Error("Generation not found");

  if (action === "skip") {
    await prisma.habitGeneration.update({
      where: { id: generationId },
      data: { status: "skipped" },
    });
  } else if (action === "delete") {
    // Delete the associated task and block
    await prisma.scheduledBlock.deleteMany({ where: { taskId: gen.taskId } });
    await prisma.task.deleteMany({ where: { id: gen.taskId, userId: session.user.id } });
    await prisma.habitGeneration.update({
      where: { id: generationId },
      data: { status: "skipped" },
    });
  } else if (action === "reschedule") {
    // Re-schedule the task for this week
    try {
      await autoScheduleTask(session.user.id, gen.taskId);
      await prisma.habitGeneration.update({
        where: { id: generationId },
        data: { status: "rescheduled" },
      });
    } catch (err) {
      console.error("Reschedule failed:", err);
    }
  }

  revalidatePath("/habits");
  revalidatePath("/");
}

export async function bulkResolveHabits(
  generationIds: string[],
  action: "skip" | "reschedule"
) {
  for (const id of generationIds) {
    await resolveHabitInstance(id, action);
  }
}
