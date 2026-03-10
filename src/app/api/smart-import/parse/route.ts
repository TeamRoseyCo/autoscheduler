import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai";
import { findNextFreeSlot } from "@/lib/local-scheduler";

export interface ParsedEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  eventType: "meeting" | "travel" | "appointment" | "social" | "deadline" | "reminder" | "class" | "other";
  color: string;
  confidence: number;
  source: string;
  suggestedByAI: boolean;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  meeting: "indigo",
  travel: "amber",
  appointment: "emerald",
  social: "pink",
  deadline: "red",
  reminder: "slate",
  class: "sky",
  other: "gray",
};

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

function parseICS(icsContent: string): Array<{
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  eventType: string;
  confidence: number;
}> {
  const events: Array<{
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
    description?: string;
    eventType: string;
    confidence: number;
  }> = [];

  const vevents = icsContent.split("BEGIN:VEVENT");

  for (let i = 1; i < vevents.length; i++) {
    const block = vevents[i].split("END:VEVENT")[0];

    const getField = (name: string): string => {
      const regex = new RegExp(`^${name}[;:](.*)`, "m");
      const match = block.match(regex);
      if (!match) return "";
      let value = match[1];
      const lines = block.split(/\r?\n/);
      const lineIdx = lines.findIndex((l) => l.match(regex));
      if (lineIdx >= 0) {
        let j = lineIdx + 1;
        while (j < lines.length && /^[ \t]/.test(lines[j])) {
          value += lines[j].slice(1);
          j++;
        }
      }
      return value.trim();
    };

    const summary = getField("SUMMARY");
    const dtstart = getField("DTSTART");
    const dtend = getField("DTEND");
    const location = getField("LOCATION");
    const description = getField("DESCRIPTION");

    if (!summary || !dtstart) continue;

    const parseICSDate = (dt: string): Date | null => {
      const parts = dt.split(":");
      const dateStr = parts.length > 1 ? parts[parts.length - 1] : dt;
      const clean = dateStr.replace(/[^0-9TZ]/g, "");
      if (clean.length >= 8) {
        const y = clean.slice(0, 4);
        const m = clean.slice(4, 6);
        const d = clean.slice(6, 8);
        if (clean.length >= 15) {
          const hh = clean.slice(9, 11);
          const mm = clean.slice(11, 13);
          return new Date(`${y}-${m}-${d}T${hh}:${mm}:00`);
        }
        return new Date(`${y}-${m}-${d}T00:00:00`);
      }
      return null;
    };

    const startDate = parseICSDate(dtstart);
    const endDate = dtend ? parseICSDate(dtend) : null;
    if (!startDate) continue;

    const date = startDate.toISOString().split("T")[0];
    const startHH = String(startDate.getHours()).padStart(2, "0");
    const startMM = String(startDate.getMinutes()).padStart(2, "0");

    let endHH = startHH;
    let endMM = String(Math.min(59, startDate.getMinutes() + 60)).padStart(2, "0");
    if (endDate) {
      endHH = String(endDate.getHours()).padStart(2, "0");
      endMM = String(endDate.getMinutes()).padStart(2, "0");
    }

    const text = (summary + " " + description).toLowerCase();
    let eventType = "other";
    if (/train|flight|bus|travel|depart|arriv|trip|boarding/i.test(text)) eventType = "travel";
    else if (/meet|call|standup|sync|1:1|review/i.test(text)) eventType = "meeting";
    else if (/doctor|dentist|appointment|consult/i.test(text)) eventType = "appointment";
    else if (/party|dinner|lunch|drinks|hang|birthday|wedding/i.test(text)) eventType = "social";
    else if (/deadline|due|submit|exam|test/i.test(text)) eventType = "deadline";
    else if (/remind|todo|follow.?up/i.test(text)) eventType = "reminder";
    else if (/class|lecture|lab|seminar|tutorial/i.test(text)) eventType = "class";

    events.push({
      title: summary.replace(/\\,/g, ",").replace(/\\n/g, " "),
      date,
      startTime: `${startHH}:${startMM}`,
      endTime: `${endHH}:${endMM}`,
      location: location ? location.replace(/\\,/g, ",").replace(/\\n/g, " ") : undefined,
      description: description ? description.replace(/\\n/g, "\n").replace(/\\,/g, ",").slice(0, 200) : undefined,
      eventType,
      confidence: 0.95,
    });
  }

  return events;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await req.json();
    const { content, source } = body as {
      content: string;
      source: "text" | "ics" | "email" | "natural_language";
    };

    if (!content?.trim()) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    let rawEvents: Array<{
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      location?: string;
      description?: string;
      eventType: string;
      confidence: number;
      suggestedByAI?: boolean;
    }> = [];

    // ICS files: parse directly without AI
    if (source === "ics") {
      rawEvents = parseICS(content);
    } else {
      // For text/email/natural_language: use AI to extract events
      const { client, model } = await getOpenAIClient(userId);
      const today = new Date().toISOString().split("T")[0];

      const isNaturalLanguage = source === "natural_language";

      const systemPrompt = isNaturalLanguage
        ? `You convert natural language scheduling requests into calendar events. Today is ${today}.

The user will describe what they want to schedule in plain language. Extract events from their request.

For each event return a JSON object with:
- title: clear event title
- date: YYYY-MM-DD (infer from "tomorrow", "next Thursday", etc. Current year: ${new Date().getFullYear()})
- startTime: HH:MM (24h format) or null if no specific time mentioned
- endTime: HH:MM or null if no time
- location: venue/address if mentioned
- description: brief note if relevant
- eventType: meeting|travel|appointment|social|deadline|reminder|class|other
- confidence: 0.0-1.0 (set to 0.3 or less if no specific time was mentioned)

Return a JSON array. Only return the JSON array.`
        : `You extract calendar events from text. Today is ${today}.

Given user text (email, message, description), extract ALL events/appointments/trips/deadlines mentioned.

For each event return a JSON object with:
- title: clear event title
- date: YYYY-MM-DD (infer year if not stated, use ${new Date().getFullYear()})
- startTime: HH:MM (24h format, estimate if not exact)
- endTime: HH:MM (estimate reasonable duration if not stated)
- location: venue/address if mentioned
- description: brief note if relevant context exists
- eventType: meeting|travel|appointment|social|deadline|reminder|class|other
- confidence: 0.0-1.0 how certain you are about the extracted details

Return a JSON array. If no events found, return [].
Only return the JSON array, no other text.`;

      const resp = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: content.slice(0, 5000) },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });

      const raw = resp.choices[0]?.message?.content || "[]";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      let parsed: Array<Record<string, unknown>> = [];
      try {
        parsed = JSON.parse(jsonMatch?.[0] || "[]");
      } catch {
        return NextResponse.json({ events: [], warning: "Could not parse AI response" });
      }

      rawEvents = parsed.map((e) => ({
        title: String(e.title || "Untitled Event"),
        date: String(e.date || today),
        startTime: e.startTime ? String(e.startTime) : "",
        endTime: e.endTime ? String(e.endTime) : "",
        location: e.location ? String(e.location) : undefined,
        description: e.description ? String(e.description) : undefined,
        eventType: [
          "meeting", "travel", "appointment", "social",
          "deadline", "reminder", "class", "other",
        ].includes(String(e.eventType))
          ? String(e.eventType)
          : "other",
        confidence: typeof e.confidence === "number" ? e.confidence : 0.7,
      }));

      // Smart scheduling: for events with missing/low-confidence times, find free slots
      for (let i = 0; i < rawEvents.length; i++) {
        const ev = rawEvents[i];
        const needsTimeSlot = !ev.startTime || !ev.endTime || ev.confidence <= 0.4;

        if (needsTimeSlot) {
          const defaults = EVENT_TYPE_DEFAULTS[ev.eventType] || EVENT_TYPE_DEFAULTS.other;
          const startFrom = ev.date ? new Date(`${ev.date}T00:00:00`) : null;

          const slot = await findNextFreeSlot(
            userId,
            defaults.duration,
            defaults.preference,
            null,
            startFrom
          );

          if (slot) {
            const startHH = String(slot.startTime.getHours()).padStart(2, "0");
            const startMM = String(slot.startTime.getMinutes()).padStart(2, "0");
            const endHH = String(slot.endTime.getHours()).padStart(2, "0");
            const endMM = String(slot.endTime.getMinutes()).padStart(2, "0");

            rawEvents[i] = {
              ...ev,
              date: slot.date,
              startTime: `${startHH}:${startMM}`,
              endTime: `${endHH}:${endMM}`,
              suggestedByAI: true,
              confidence: Math.max(ev.confidence, 0.5),
            };
          } else if (!ev.startTime) {
            // Fallback: set default time
            rawEvents[i] = {
              ...ev,
              startTime: "09:00",
              endTime: `${String(Math.floor(9 + defaults.duration / 60)).padStart(2, "0")}:${String(defaults.duration % 60).padStart(2, "0")}`,
              suggestedByAI: true,
            };
          }
        }
      }
    }

    // Persist to DB
    const persistedEvents: ParsedEvent[] = [];

    for (const ev of rawEvents) {
      const event = await prisma.smartImportEvent.create({
        data: {
          userId,
          title: ev.title,
          date: ev.date,
          startTime: ev.startTime,
          endTime: ev.endTime,
          location: ev.location || null,
          description: ev.description || null,
          eventType: ev.eventType,
          color: EVENT_TYPE_COLORS[ev.eventType] || "gray",
          confidence: ev.confidence,
          source,
          suggestedByAI: ev.suggestedByAI || false,
          status: "pending",
        },
      });

      persistedEvents.push({
        id: event.id,
        title: event.title,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location || undefined,
        description: event.description || undefined,
        eventType: event.eventType as ParsedEvent["eventType"],
        color: event.color,
        confidence: event.confidence,
        source: event.source,
        suggestedByAI: event.suggestedByAI,
      });
    }

    return NextResponse.json({ events: persistedEvents });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to parse";
    if (msg.includes("API key not configured")) {
      return NextResponse.json({
        error: "AI API key required. Add one in Settings.",
      }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
