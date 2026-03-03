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
  const starred = searchParams.get("starred");
  const type = searchParams.get("type");

  const where: any = { userId: session.user.id };
  if (courseId) where.courseId = courseId;
  if (starred === "true") where.starred = true;
  if (type) where.type = type;

  const resources = await prisma.uniResource.findMany({
    where,
    include: { course: true },
    orderBy: [{ starred: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(resources);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();

    const resource = await prisma.uniResource.create({
      data: {
        title: data.title,
        url: data.url || null,
        type: data.type || "link",
        category: data.category || null,
        notes: data.notes || null,
        starred: data.starred || false,
        courseId: data.courseId || null,
        userId: session.user.id,
      },
      include: { course: true },
    });

    return NextResponse.json(resource);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
