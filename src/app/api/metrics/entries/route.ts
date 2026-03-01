import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const metricId = searchParams.get("metricId") ?? undefined;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  const entries = await prisma.metricEntry.findMany({
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

  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { metricId, value, taskId, date, notes } = body;

  if (!metricId || value === undefined || value === null) {
    return NextResponse.json({ error: "metricId and value are required" }, { status: 400 });
  }

  // Verify metric belongs to user
  const metric = await prisma.metricDefinition.findFirst({
    where: { id: metricId, userId: session.user.id },
  });
  if (!metric) return NextResponse.json({ error: "Metric not found" }, { status: 404 });

  const entry = await prisma.metricEntry.create({
    data: {
      userId: session.user.id,
      metricId,
      value: Number(value),
      taskId: taskId || null,
      date: date ? new Date(date) : new Date(),
      notes: notes || null,
    },
    include: { metric: true },
  });

  return NextResponse.json(entry);
}
