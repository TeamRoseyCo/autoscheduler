import { getGoogleCalendarClient } from "@/lib/google-auth";
import { parseTime } from "@/lib/utils";
import type { FreeSlot } from "@/types";

interface BusySlot {
  start: Date;
  end: Date;
  summary?: string;
}

export async function getBusySlots(
  userId: string,
  start: Date,
  end: Date
): Promise<BusySlot[]> {
  const calendar = await getGoogleCalendarClient(userId);

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = response.data.items || [];

  return events
    .filter((event) => {
      // Skip all-day events and cancelled events
      if (!event.start?.dateTime || !event.end?.dateTime) return false;
      if (event.status === "cancelled") return false;
      return true;
    })
    .map((event) => ({
      start: new Date(event.start!.dateTime!),
      end: new Date(event.end!.dateTime!),
      summary: event.summary || undefined,
    }));
}

export function computeFreeSlots(
  busySlots: BusySlot[],
  workStartTime: string,
  workEndTime: string,
  date: string, // YYYY-MM-DD
  timezone: string
): FreeSlot[] {
  const workStart = parseTime(workStartTime);
  const workEnd = parseTime(workEndTime);

  // Create work window boundaries in the given timezone
  const dayStart = new Date(`${date}T${workStartTime}:00`);
  const dayEnd = new Date(`${date}T${workEndTime}:00`);

  // Sort busy slots by start time
  const sorted = [...busySlots].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  const freeSlots: FreeSlot[] = [];
  let cursor = dayStart.getTime();

  for (const busy of sorted) {
    const busyStart = busy.start.getTime();
    const busyEnd = busy.end.getTime();

    // Skip events outside work hours
    if (busyEnd <= dayStart.getTime() || busyStart >= dayEnd.getTime())
      continue;

    // Clamp busy slot to work hours
    const effectiveStart = Math.max(busyStart, dayStart.getTime());
    const effectiveEnd = Math.min(busyEnd, dayEnd.getTime());

    if (cursor < effectiveStart) {
      const durationMinutes = (effectiveStart - cursor) / (1000 * 60);
      if (durationMinutes >= 5) {
        freeSlots.push({
          start: new Date(cursor),
          end: new Date(effectiveStart),
          durationMinutes: Math.floor(durationMinutes),
        });
      }
    }

    cursor = Math.max(cursor, effectiveEnd);
  }

  // Final gap after last busy slot
  if (cursor < dayEnd.getTime()) {
    const durationMinutes = (dayEnd.getTime() - cursor) / (1000 * 60);
    if (durationMinutes >= 5) {
      freeSlots.push({
        start: new Date(cursor),
        end: dayEnd,
        durationMinutes: Math.floor(durationMinutes),
      });
    }
  }

  return freeSlots;
}

export async function createCalendarEvent(
  userId: string,
  summary: string,
  start: Date,
  end: Date
): Promise<string> {
  const calendar = await getGoogleCalendarClient(userId);

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      colorId: "9", // blueberry
    },
  });

  return response.data.id!;
}

export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<void> {
  const calendar = await getGoogleCalendarClient(userId);

  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });
  } catch (error: unknown) {
    // Ignore 404 (event already deleted)
    const status = (error as { code?: number })?.code;
    if (status !== 404) throw error;
  }
}
