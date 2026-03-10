import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await req.json();
    const { eventIds } = body as { eventIds: string[] };

    if (!eventIds?.length) {
      return NextResponse.json({ error: "No events to create" }, { status: 400 });
    }

    // Fetch the pending events
    const events = await prisma.smartImportEvent.findMany({
      where: {
        id: { in: eventIds },
        userId,
        status: "pending",
      },
    });

    if (events.length === 0) {
      return NextResponse.json({ error: "No valid pending events found" }, { status: 400 });
    }

    const created: string[] = [];

    for (const ev of events) {
      const startISO = new Date(`${ev.date}T${ev.startTime}:00`).toISOString();
      const endISO = new Date(`${ev.date}T${ev.endTime}:00`).toISOString();

      const block = await prisma.scheduledBlock.create({
        data: {
          userId,
          title: ev.title,
          date: ev.date,
          startTime: startISO,
          endTime: endISO,
          color: ev.color || "gray",
          location: ev.location || null,
          status: "scheduled",
          availability: "busy",
        },
      });

      // Update the import event status
      await prisma.smartImportEvent.update({
        where: { id: ev.id },
        data: {
          status: "created",
          scheduledBlockId: block.id,
        },
      });

      created.push(ev.title);
    }

    return NextResponse.json({ created, count: created.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create events";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
