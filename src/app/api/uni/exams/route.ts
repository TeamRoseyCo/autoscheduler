import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncExamToCalendar } from "@/lib/actions/uni/exams";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");
  const completed = searchParams.get("completed");

  const where: any = { userId: session.user.id };
  if (courseId) where.courseId = courseId;
  if (completed !== null) where.completed = completed === "true";

  const exams = await prisma.uniExam.findMany({
    where,
    include: { course: true },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(exams);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();

    const exam = await prisma.uniExam.create({
      data: {
        ...data,
        date: new Date(data.date),
        userId: session.user.id,
      },
      include: { course: true },
    });

    // Trigger calendar sync
    await syncExamToCalendar(exam.id).catch(() => null);

    return NextResponse.json(exam);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
