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
  const pinned = searchParams.get("pinned");

  const where: any = { userId: session.user.id };
  if (courseId) where.courseId = courseId;
  if (pinned === "true") where.pinned = true;

  const notes = await prisma.uniNote.findMany({
    where,
    include: { course: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(notes);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();

    const note = await prisma.uniNote.create({
      data: {
        title: data.title,
        content: data.content || "",
        tags: data.tags || null,
        pinned: data.pinned || false,
        courseId: data.courseId || null,
        userId: session.user.id,
      },
      include: { course: true },
    });

    return NextResponse.json(note);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
