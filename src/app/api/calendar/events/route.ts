import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent } from "@/lib/google-calendar";

interface CreateEventBody {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  color?: string;
  availability?: string;
  addToGoogle?: boolean;
  location?: string;
  transportBefore?: number;
  transportAfter?: number;
  transportMode?: string;
  allDay?: boolean;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: CreateEventBody = await request.json();

    if (!body.title || !body.date || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: "title, date, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return NextResponse.json(
        { error: "Invalid startTime or endTime" },
        { status: 400 }
      );
    }

    if (endTime <= startTime) {
      return NextResponse.json(
        { error: "endTime must be after startTime" },
        { status: 400 }
      );
    }

    let googleEventId: string | null = null;

    // Create in Google Calendar if requested
    if (body.addToGoogle) {
      try {
        googleEventId = await createCalendarEvent(
          session.user.id,
          body.title,
          startTime,
          endTime
        );
      } catch (error: unknown) {
        console.error("Failed to create Google Calendar event:", error);
        // Continue without Google event - don't fail the whole request
      }
    }

    const block = await prisma.scheduledBlock.create({
      data: {
        userId: session.user.id,
        title: body.title,
        date: body.date,
        startTime,
        endTime,
        color: body.color || "indigo",
        availability: body.availability || "busy",
        googleEventId,
        location: body.location || null,
        transportBefore: body.transportBefore ?? null,
        transportAfter: body.transportAfter ?? null,
        transportMode: body.transportMode || null,
        allDay: body.allDay || false,
      },
    });

    return NextResponse.json(block, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create event";
    console.error("Create event error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
