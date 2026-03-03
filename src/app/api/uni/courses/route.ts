import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const semesterId = searchParams.get("semesterId");

  const where: any = { userId: session.user.id };
  if (semesterId) {
    where.semesterId = semesterId;
  }

  const courses = await prisma.uniCourse.findMany({
    where,
    orderBy: { code: "asc" },
  });

  return NextResponse.json(courses);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();

    const course = await prisma.uniCourse.create({
      data: {
        ...data,
        userId: session.user.id,
      },
    });

    return NextResponse.json(course);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
