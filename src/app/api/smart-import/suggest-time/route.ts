import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findNextFreeSlot } from "@/lib/local-scheduler";

const EVENT_TYPE_DEFAULTS: Record<string, { duration: number; preference: string | null }> = {
  meeting: { duration: 60, preference: null },
  travel: { duration: 120, preference: null },
  appointment: { duration: 60, preference: "morning" },
  social: { duration: 120, preference: "evening" },
  deadline: { duration: 30, preference: null },
  reminder: { duration: 15, preference: "morning" },
  class: { duration: 90, preference: null },
  other: { duration: 60, preference: null },
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { eventType, date, durationMinutes } = body as {
      eventType?: string;
      date?: string;
      durationMinutes?: number;
    };

    const defaults = EVENT_TYPE_DEFAULTS[eventType || "other"] || EVENT_TYPE_DEFAULTS.other;
    const duration = durationMinutes || defaults.duration;
    const preference = defaults.preference;

    const suggestions: Array<{
      date: string;
      startTime: string;
      endTime: string;
      label: string;
    }> = [];

    // Generate up to 3 suggestions with different preferences
    const preferences = [preference, "morning", "afternoon", "evening"].filter(
      (v, i, arr) => arr.indexOf(v) === i
    );

    for (const pref of preferences) {
      if (suggestions.length >= 3) break;

      const startFrom = date ? new Date(`${date}T00:00:00`) : null;
      const slot = await findNextFreeSlot(
        session.user.id,
        duration,
        pref,
        null,
        startFrom
      );

      if (!slot) continue;

      const startHH = String(slot.startTime.getHours()).padStart(2, "0");
      const startMM = String(slot.startTime.getMinutes()).padStart(2, "0");
      const endHH = String(slot.endTime.getHours()).padStart(2, "0");
      const endMM = String(slot.endTime.getMinutes()).padStart(2, "0");

      const suggestion = {
        date: slot.date,
        startTime: `${startHH}:${startMM}`,
        endTime: `${endHH}:${endMM}`,
        label: pref ? `${pref.charAt(0).toUpperCase() + pref.slice(1)} slot` : "Best available",
      };

      // Avoid duplicate suggestions
      const key = `${suggestion.date}-${suggestion.startTime}`;
      if (!suggestions.some((s) => `${s.date}-${s.startTime}` === key)) {
        suggestions.push(suggestion);
      }
    }

    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to suggest times";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
