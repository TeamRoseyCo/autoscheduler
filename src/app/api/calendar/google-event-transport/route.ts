import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/calendar/google-event-transport
// Body: { googleEventId, location?, transportBefore?, transportAfter?, transportMode? }
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { googleEventId, location, transportBefore, transportAfter, transportMode } = body;

    if (!googleEventId) {
      return NextResponse.json({ error: "googleEventId is required" }, { status: 400 });
    }

    const record = await prisma.googleEventTransport.upsert({
      where: { userId_googleEventId: { userId: session.user.id, googleEventId } },
      update: {
        location: location ?? null,
        transportBefore: transportBefore ?? null,
        transportAfter: transportAfter ?? null,
        transportMode: transportMode ?? null,
      },
      create: {
        userId: session.user.id,
        googleEventId,
        location: location ?? null,
        transportBefore: transportBefore ?? null,
        transportAfter: transportAfter ?? null,
        transportMode: transportMode ?? null,
      },
    });

    return NextResponse.json(record);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save transport";
    console.error("Google event transport save error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/calendar/google-event-transport?googleEventId=xxx
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const googleEventId = new URL(request.url).searchParams.get("googleEventId");
  if (!googleEventId) {
    return NextResponse.json({ error: "googleEventId is required" }, { status: 400 });
  }

  try {
    await prisma.googleEventTransport.deleteMany({
      where: { userId: session.user.id, googleEventId },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete transport";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
