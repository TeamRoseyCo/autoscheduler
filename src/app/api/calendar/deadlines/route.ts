import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate query parameters are required" },
      { status: 400 }
    );
  }

  // Find tasks with deadlines in the visible range
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      deadline: { gte: start, lte: end },
      taskStatus: { notIn: ["completed", "cancelled"] },
    },
    select: {
      id: true,
      title: true,
      deadline: true,
      deadlineTime: true,
      priority: true,
      project: { select: { name: true, color: true } },
    },
    orderBy: { deadline: "asc" },
  });

  // Map to a simple format for the calendar
  const deadlines = tasks.map((t) => {
    const deadlineDate = new Date(t.deadline!);
    const dateKey = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, "0")}-${String(deadlineDate.getDate()).padStart(2, "0")}`;

    return {
      id: t.id,
      title: t.title,
      date: dateKey,
      time: t.deadlineTime || null, // HH:MM or null (end of day)
      priority: t.priority,
      projectName: t.project?.name || null,
      projectColor: t.project?.color || null,
    };
  });

  return NextResponse.json(deadlines);
}
