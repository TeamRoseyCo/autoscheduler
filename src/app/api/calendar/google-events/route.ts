import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGoogleCalendarClient } from "@/lib/google-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate query parameters are required" },
      { status: 400 }
    );
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return NextResponse.json(
      { error: "Dates must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  try {
    const calendar = await getGoogleCalendarClient(session.user.id);

    const timeMin = new Date(`${startDate}T00:00:00`).toISOString();
    const timeMax = new Date(`${endDate}T23:59:59`).toISOString();

    const response = await Promise.race([
      calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Google Calendar request timed out after 12s")), 12000)
      ),
    ]);

    const rawEvents = (response.data.items || []).filter((event) => {
      if (!event.start?.dateTime || !event.end?.dateTime) return false;
      if (event.status === "cancelled") return false;
      return true;
    });

    // Fetch any saved transport data for these events in one query (non-fatal)
    const googleEventIds = rawEvents.map((e) => e.id!).filter(Boolean);
    let transportMap = new Map<string, { location: string | null; transportBefore: number | null; transportAfter: number | null; transportMode: string | null }>();
    try {
      const transportRecords = googleEventIds.length > 0
        ? await prisma.googleEventTransport.findMany({
            where: { userId: session.user.id, googleEventId: { in: googleEventIds } },
          })
        : [];
      transportMap = new Map(transportRecords.map((r) => [r.googleEventId, r]));
    } catch {
      // Transport data unavailable — proceed without it (server restart may be needed after schema change)
    }

    const events = rawEvents.map((event) => {
      const start = new Date(event.start!.dateTime!);
      const end = new Date(event.end!.dateTime!);
      const dateStr = start.toISOString().split("T")[0];
      const transparency = (event as { transparency?: string }).transparency;
      const availability = transparency === "transparent" ? "free" : "busy";
      const transport = transportMap.get(event.id!);

      return {
        id: `google-${event.id}`,
        googleEventId: event.id,
        title: event.summary || "(No title)",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        date: dateStr,
        color: "gray",
        source: "google" as const,
        availability,
        ...(transport && {
          location: transport.location ?? undefined,
          transportBefore: transport.transportBefore ?? undefined,
          transportAfter: transport.transportAfter ?? undefined,
          transportMode: transport.transportMode ?? undefined,
        }),
      };
    });

    return NextResponse.json(events);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch Google Calendar events";
    console.error("Google Calendar fetch error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
