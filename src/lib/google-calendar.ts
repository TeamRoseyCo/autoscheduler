import { getGoogleCalendarClient } from "@/lib/google-auth";
import { parseTime } from "@/lib/utils";
import type { Availability, EnergyType, FreeSlot } from "@/types";

export interface BusySlot {
  start: Date;
  end: Date;
  summary?: string;
  availability: Availability;
}

/**
 * Map an availability level to the set of energy types allowed during that time.
 * - busy → nothing allowed (returns empty array)
 * - free_tight → light + admin only (no deep work)
 * - free_light → light only
 * - free → all types (deep + light + admin)
 */
export function availabilityToAllowedEnergy(availability: Availability): EnergyType[] {
  switch (availability) {
    case "busy": return [];
    case "free_tight": return ["light", "admin"];
    case "free_light": return ["light"];
    case "free": return ["deep", "light", "admin"];
  }
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
      // Skip all-day events (no dateTime) and cancelled events
      if (!event.start?.dateTime || !event.end?.dateTime) return false;
      if (event.status === "cancelled") return false;
      return true;
    })
    .map((event) => {
      // Google Calendar: transparency "transparent" = free, "opaque" (default) = busy
      const transparency = (event as { transparency?: string }).transparency;
      const availability: Availability = transparency === "transparent" ? "free" : "busy";

      return {
        start: new Date(event.start!.dateTime!),
        end: new Date(event.end!.dateTime!),
        summary: event.summary || undefined,
        availability,
      };
    });
}

/**
 * Compute free slots from busy slots, now availability-aware.
 *
 * The algorithm:
 * 1. "busy" events → fully block the time (current behavior)
 * 2. "free_tight" / "free_light" events → the time stays available but with energy restrictions
 * 3. "free" events → don't block time at all (transparent)
 *
 * Returns FreeSlot[] where each slot has an optional `allowedEnergy` field.
 * Unrestricted slots have no `allowedEnergy` (all types allowed).
 * Restricted slots list exactly which energy types can be scheduled there.
 */
export function computeFreeSlots(
  busySlots: BusySlot[],
  workStartTime: string,
  workEndTime: string,
  date: string, // YYYY-MM-DD
  timezone: string
): FreeSlot[] {
  const dayStart = new Date(`${date}T${workStartTime}:00`);
  const dayEnd = new Date(`${date}T${workEndTime}:00`);

  // Separate into blocking (busy) and restricting (free_tight, free_light) events
  // "free" events are fully transparent — ignored entirely
  const blockingSlots = busySlots
    .filter((s) => s.availability === "busy")
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const restrictedSlots = busySlots
    .filter((s) => s.availability === "free_tight" || s.availability === "free_light")
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Step 1: Compute gaps from blocking (busy) events — same as before
  const rawFreeSlots: { start: number; end: number }[] = [];
  let cursor = dayStart.getTime();

  for (const busy of blockingSlots) {
    const busyStart = busy.start.getTime();
    const busyEnd = busy.end.getTime();

    // Skip events outside work hours
    if (busyEnd <= dayStart.getTime() || busyStart >= dayEnd.getTime()) continue;

    const effectiveStart = Math.max(busyStart, dayStart.getTime());
    const effectiveEnd = Math.min(busyEnd, dayEnd.getTime());

    if (cursor < effectiveStart) {
      rawFreeSlots.push({ start: cursor, end: effectiveStart });
    }

    cursor = Math.max(cursor, effectiveEnd);
  }

  // Final gap after last busy slot
  if (cursor < dayEnd.getTime()) {
    rawFreeSlots.push({ start: cursor, end: dayEnd.getTime() });
  }

  // Step 2: Split free slots where restricted events overlap, applying energy restrictions
  const result: FreeSlot[] = [];

  for (const free of rawFreeSlots) {
    // Find restricted events that overlap this free slot
    const overlapping = restrictedSlots.filter((r) => {
      const rStart = Math.max(r.start.getTime(), dayStart.getTime());
      const rEnd = Math.min(r.end.getTime(), dayEnd.getTime());
      return rStart < free.end && rEnd > free.start;
    });

    if (overlapping.length === 0) {
      // No restrictions — fully open slot
      const mins = (free.end - free.start) / 60000;
      if (mins >= 5) {
        result.push({
          start: new Date(free.start),
          end: new Date(free.end),
          durationMinutes: Math.floor(mins),
        });
      }
      continue;
    }

    // Split free slot around restricted events
    let splitCursor = free.start;

    for (const r of overlapping) {
      const rStart = Math.max(r.start.getTime(), free.start);
      const rEnd = Math.min(r.end.getTime(), free.end);

      // Unrestricted gap before restricted event
      if (splitCursor < rStart) {
        const mins = (rStart - splitCursor) / 60000;
        if (mins >= 5) {
          result.push({
            start: new Date(splitCursor),
            end: new Date(rStart),
            durationMinutes: Math.floor(mins),
          });
        }
      }

      // Restricted slot
      const actualStart = Math.max(splitCursor, rStart);
      const mins = (rEnd - actualStart) / 60000;
      if (mins >= 5) {
        result.push({
          start: new Date(actualStart),
          end: new Date(rEnd),
          durationMinutes: Math.floor(mins),
          allowedEnergy: availabilityToAllowedEnergy(r.availability),
        });
      }

      splitCursor = Math.max(splitCursor, rEnd);
    }

    // Unrestricted gap after last restricted event
    if (splitCursor < free.end) {
      const mins = (free.end - splitCursor) / 60000;
      if (mins >= 5) {
        result.push({
          start: new Date(splitCursor),
          end: new Date(free.end),
          durationMinutes: Math.floor(mins),
        });
      }
    }
  }

  return result;
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
