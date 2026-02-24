import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGoogleCalendarClient } from "@/lib/google-auth";

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

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    const events = (response.data.items || [])
      .filter((event) => {
        // Skip all-day events (no dateTime) and cancelled events
        if (!event.start?.dateTime || !event.end?.dateTime) return false;
        if (event.status === "cancelled") return false;
        return true;
      })
      .map((event) => {
        const start = new Date(event.start!.dateTime!);
        const end = new Date(event.end!.dateTime!);
        const dateStr = start.toISOString().split("T")[0];

        return {
          id: `google-${event.id}`,
          googleEventId: event.id,
          title: event.summary || "(No title)",
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          date: dateStr,
          color: "gray",
          source: "google" as const,
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
