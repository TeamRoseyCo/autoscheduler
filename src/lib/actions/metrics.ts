"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRESET_METRICS } from "@/lib/preset-metrics";
import { revalidatePath } from "next/cache";

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

function subYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() - n);
  return r;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function seedPresetMetrics(userId: string) {
  const existing = await prisma.metricDefinition.count({ where: { userId } });
  if (existing > 0) return;

  await prisma.metricDefinition.createMany({
    data: PRESET_METRICS.map((m) => ({
      userId,
      name: m.name,
      unit: m.unit,
      icon: m.icon,
      category: m.category,
      aggregation: m.aggregation,
      isPreset: true,
    })),
  });
}

export async function getMetrics() {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Seed on first call
  await seedPresetMetrics(session.user.id);

  return prisma.metricDefinition.findMany({
    where: { userId: session.user.id },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function createMetricEntry(
  metricId: string,
  value: number,
  taskId?: string,
  date?: string,
  notes?: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const entry = await prisma.metricEntry.create({
    data: {
      userId: session.user.id,
      metricId,
      taskId: taskId || null,
      value,
      date: date ? new Date(date) : new Date(),
      notes: notes || null,
    },
    include: {
      metric: true,
    },
  });

  revalidatePath("/stats");
  return entry;
}

export async function getMetricEntries(
  metricId?: string,
  startDate?: string,
  endDate?: string
) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.metricEntry.findMany({
    where: {
      userId: session.user.id,
      ...(metricId ? { metricId } : {}),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    },
    include: { metric: true },
    orderBy: { date: "desc" },
  });
}

export async function getStatsData(range: "week" | "month" | "year" = "week") {
  const session = await auth();
  if (!session?.user?.id) return null;

  const now = new Date();
  let rangeStart: Date;
  let prevStart: Date;
  let prevEnd: Date;

  if (range === "week") {
    rangeStart = subDays(startOfDay(now), 6);
    prevEnd = subDays(rangeStart, 1);
    prevStart = subDays(prevEnd, 6);
  } else if (range === "month") {
    rangeStart = subDays(startOfDay(now), 29);
    prevEnd = subDays(rangeStart, 1);
    prevStart = subDays(prevEnd, 29);
  } else {
    rangeStart = subYears(startOfDay(now), 1);
    prevEnd = subDays(rangeStart, 1);
    prevStart = subYears(prevEnd, 1);
  }

  const [blocks, metricEntries, prevMetricEntries, projects] = await Promise.all([
    prisma.scheduledBlock.findMany({
      where: {
        userId: session.user.id,
        startTime: { gte: rangeStart, lte: endOfDay(now) },
        status: "completed",
      },
      include: {
        task: {
          include: { project: { select: { id: true, name: true, color: true } } },
        },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.metricEntry.findMany({
      where: {
        userId: session.user.id,
        date: { gte: rangeStart, lte: endOfDay(now) },
      },
      include: { metric: true },
      orderBy: { date: "asc" },
    }),
    prisma.metricEntry.findMany({
      where: {
        userId: session.user.id,
        date: { gte: prevStart, lte: endOfDay(prevEnd) },
      },
      include: { metric: true },
    }),
    prisma.project.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, color: true },
    }),
  ]);

  // ── Time by project ──────────────────────────────────────────────────────────
  const projectMap = new Map<string, { name: string; color: string; minutes: number }>();
  let unassignedMinutes = 0;

  for (const block of blocks) {
    const minutes = Math.round(
      (new Date(block.endTime).getTime() - new Date(block.startTime).getTime()) / 60000
    );
    const project = block.task?.project;
    if (project) {
      const existing = projectMap.get(project.id);
      if (existing) {
        existing.minutes += minutes;
      } else {
        projectMap.set(project.id, { name: project.name, color: project.color, minutes });
      }
    } else {
      unassignedMinutes += minutes;
    }
  }

  const timeByProject = [
    ...Array.from(projectMap.entries()).map(([id, v]) => ({ id, ...v })),
    ...(unassignedMinutes > 0
      ? [{ id: "none", name: "No Project", color: "gray", minutes: unassignedMinutes }]
      : []),
  ];

  // ── Daily hours ──────────────────────────────────────────────────────────────
  const dailyMap = new Map<string, { deep: number; light: number; admin: number }>();
  for (const block of blocks) {
    const day = formatDate(new Date(block.startTime));
    const minutes = Math.round(
      (new Date(block.endTime).getTime() - new Date(block.startTime).getTime()) / 60000
    );
    const energy = block.task?.energyType ?? "admin";
    const existing = dailyMap.get(day) ?? { deep: 0, light: 0, admin: 0 };
    if (energy === "deep") existing.deep += minutes;
    else if (energy === "light") existing.light += minutes;
    else existing.admin += minutes;
    dailyMap.set(day, existing);
  }

  const dailyHours = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      deep: Math.round((v.deep / 60) * 10) / 10,
      light: Math.round((v.light / 60) * 10) / 10,
      admin: Math.round((v.admin / 60) * 10) / 10,
    }));

  // ── Metric summaries ─────────────────────────────────────────────────────────
  type MetricSummary = {
    metricId: string;
    name: string;
    unit: string;
    icon: string;
    aggregation: string;
    value: number;
    prevValue: number;
    entries: { date: string; value: number }[];
  };

  const metricSummaryMap = new Map<string, MetricSummary>();

  for (const entry of metricEntries) {
    const m = entry.metric;
    if (!metricSummaryMap.has(m.id)) {
      metricSummaryMap.set(m.id, {
        metricId: m.id,
        name: m.name,
        unit: m.unit,
        icon: m.icon,
        aggregation: m.aggregation,
        value: 0,
        prevValue: 0,
        entries: [],
      });
    }
    const summary = metricSummaryMap.get(m.id)!;
    summary.entries.push({ date: formatDate(new Date(entry.date)), value: entry.value });
    if (m.aggregation === "sum") summary.value += entry.value;
    else if (m.aggregation === "max") summary.value = Math.max(summary.value, entry.value);
    else if (m.aggregation === "avg") summary.value += entry.value; // divide later
    else if (m.aggregation === "last") summary.value = entry.value; // entries sorted asc
  }

  // Fix avg
  for (const [, s] of metricSummaryMap) {
    if (s.aggregation === "avg" && s.entries.length > 0) {
      s.value = Math.round((s.value / s.entries.length) * 100) / 100;
    }
  }

  // Prev period values for trend
  const prevByMetric = new Map<string, number[]>();
  for (const entry of prevMetricEntries) {
    const arr = prevByMetric.get(entry.metricId) ?? [];
    arr.push(entry.value);
    prevByMetric.set(entry.metricId, arr);
  }

  for (const [id, s] of metricSummaryMap) {
    const prevVals = prevByMetric.get(id) ?? [];
    if (s.aggregation === "sum") s.prevValue = prevVals.reduce((a, b) => a + b, 0);
    else if (s.aggregation === "max") s.prevValue = prevVals.length ? Math.max(...prevVals) : 0;
    else if (s.aggregation === "avg")
      s.prevValue = prevVals.length ? prevVals.reduce((a, b) => a + b, 0) / prevVals.length : 0;
    else if (s.aggregation === "last") s.prevValue = prevVals[prevVals.length - 1] ?? 0;
  }

  const metricSummaries = Array.from(metricSummaryMap.values());

  return { timeByProject, dailyHours, metricSummaries, rangeStart: rangeStart.toISOString() };
}
