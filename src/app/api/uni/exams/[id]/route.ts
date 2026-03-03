import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncExamToCalendar } from "@/lib/actions/uni/exams";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const exam = await prisma.uniExam.findUnique({
    where: { id },
    include: { course: true },
  });

  if (!exam) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(exam);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const exam = await prisma.uniExam.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
      include: { course: true },
    });

    await syncExamToCalendar(exam.id).catch(() => null);
    return NextResponse.json(exam);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const exam = await prisma.uniExam.findUnique({ where: { id } });

    if (exam?.calendarBlockId) {
      await prisma.scheduledBlock.delete({
        where: { id: exam.calendarBlockId },
      }).catch(() => null);
    }

    if (exam?.studyTaskId) {
      await prisma.task.delete({
        where: { id: exam.studyTaskId },
      }).catch(() => null);
    }

    await prisma.uniExam.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 400 }
    );
  }
}
