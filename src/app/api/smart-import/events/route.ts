import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: fetch pending events for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await prisma.smartImportEvent.findMany({
    where: { userId: session.user.id, status: "pending" },
    orderBy: { createdAt: "desc" },
    include: { config: { select: { name: true } } },
  });

  return NextResponse.json({ events });
}

// PATCH: update a pending event (inline editing)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...updates } = body as {
    id: string;
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    eventType?: string;
    color?: string;
    status?: string;
  };

  if (!id) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  const event = await prisma.smartImportEvent.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const updated = await prisma.smartImportEvent.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json({ event: updated });
}

// DELETE: reject/dismiss a pending event
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  const event = await prisma.smartImportEvent.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.smartImportEvent.update({
    where: { id },
    data: { status: "rejected" },
  });

  return NextResponse.json({ success: true });
}
