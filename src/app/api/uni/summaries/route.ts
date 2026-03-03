import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");

  const where: any = { userId: session.user.id };
  if (courseId) where.courseId = courseId;

  const summaries = await prisma.uniClassSummary.findMany({
    where,
    include: { course: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(summaries);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();

    const summary = await prisma.uniClassSummary.create({
      data: {
        date: new Date(data.date),
        type: data.type,
        topics: data.topics || null,
        summary: data.summary || null,
        keyTakeaways: data.keyTakeaways || null,
        questions: data.questions || null,
        courseId: data.courseId || null,
        userId: session.user.id,
      },
      include: { course: true },
    });

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
