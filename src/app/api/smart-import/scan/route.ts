import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scanGmailForEvents } from "@/lib/google-gmail";
import { getOpenAIClient } from "@/lib/openai";

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
    const { configId } = body as { configId: string };

    if (!configId) {
      return NextResponse.json({ error: "Missing configId" }, { status: 400 });
    }

    const config = await prisma.smartImportConfig.findFirst({
      where: { id: configId, userId },
    });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    if (!config.gmailQuery) {
      return NextResponse.json({ error: "No Gmail query configured" }, { status: 400 });
    }

    // Mark as scanning
    await prisma.smartImportConfig.update({
      where: { id: configId },
      data: { lastScanStatus: "scanning" },
    });

    try {
      // Scan Gmail
      const afterDate = config.lastScanAt || undefined;
      const messages = await scanGmailForEvents(userId, config.gmailQuery, 20, afterDate || undefined);

      if (messages.length === 0) {
        await prisma.smartImportConfig.update({
          where: { id: configId },
          data: {
            lastScanAt: new Date(),
            lastScanStatus: "success",
            lastScanCount: 0,
          },
        });
        return NextResponse.json({ count: 0, events: [] });
      }

      // Process ICS attachments first
      const icsEvents: Array<{
        title: string;
        date: string;
        startTime: string;
        endTime: string;
        location?: string;
        description?: string;
        eventType: string;
        confidence: number;
        messageId: string;
      }> = [];

      const textMessages: typeof messages = [];

      for (const msg of messages) {
        // Check dedup
        const existing = await prisma.smartImportEvent.findFirst({
          where: { userId, sourceRef: `gmail:${msg.messageId}` },
        });
        if (existing) continue;

        if (msg.icsAttachments.length > 0) {
          for (const ics of msg.icsAttachments) {
            const parsed = parseICS(ics);
            for (const ev of parsed) {
              icsEvents.push({ ...ev, messageId: msg.messageId });
            }
          }
        } else {
          textMessages.push(msg);
        }
      }

      // Use AI to parse text emails
      let aiParsed: Array<{
        title: string;
        date: string;
        startTime: string;
        endTime: string;
        location?: string;
        description?: string;
        eventType: string;
        confidence: number;
        messageId: string;
      }> = [];

      if (textMessages.length > 0) {
        try {
          const { client, model } = await getOpenAIClient(userId);
          const today = new Date().toISOString().split("T")[0];

          const emailSummaries = textMessages
            .map(
              (m) =>
                `---EMAIL (id:${m.messageId})---\nSubject: ${m.subject}\nFrom: ${m.from}\nDate: ${m.date}\n\n${m.bodyText}\n---END---`
            )
            .join("\n\n");

          const resp = await client.chat.completions.create({
            model,
            messages: [
              {
                role: "system",
                content: `You extract calendar events from emails. Today is ${today}.

For each event found return a JSON object with:
- messageId: the email ID from the header
- title: clear event title
- date: YYYY-MM-DD (infer year if not stated, use ${new Date().getFullYear()})
- startTime: HH:MM (24h format, estimate if not exact)
- endTime: HH:MM (estimate duration if not stated)
- location: venue/address if mentioned
- description: brief context
- eventType: meeting|travel|appointment|social|deadline|reminder|class|other
- confidence: 0.0-1.0

Return a JSON array. If no events found, return [].
Only return the JSON array.`,
              },
              { role: "user", content: emailSummaries.slice(0, 8000) },
            ],
            max_tokens: 3000,
            temperature: 0.1,
          });

          const raw = resp.choices[0]?.message?.content || "[]";
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          try {
            const parsed = JSON.parse(jsonMatch?.[0] || "[]") as Array<Record<string, unknown>>;
            aiParsed = parsed.map((e) => ({
              title: String(e.title || "Untitled Event"),
              date: String(e.date || today),
              startTime: String(e.startTime || "09:00"),
              endTime: String(e.endTime || "10:00"),
              location: e.location ? String(e.location) : undefined,
              description: e.description ? String(e.description) : undefined,
              eventType: [
                "meeting", "travel", "appointment", "social",
                "deadline", "reminder", "class", "other",
              ].includes(String(e.eventType))
                ? String(e.eventType)
                : "other",
              confidence: typeof e.confidence === "number" ? e.confidence : 0.7,
              messageId: String(e.messageId || ""),
            }));
          } catch {
            // Failed to parse AI response
          }
        } catch (err) {
          console.error("AI parsing of Gmail messages failed:", err);
        }
      }

      // Persist all events to DB
      const allEvents = [
        ...icsEvents.map((e) => ({ ...e, source: "gmail" as const })),
        ...aiParsed.map((e) => ({ ...e, source: "gmail" as const })),
      ];

      const created = [];
      for (const ev of allEvents) {
        const event = await prisma.smartImportEvent.create({
          data: {
            userId,
            configId,
            title: ev.title,
            date: ev.date,
            startTime: ev.startTime,
            endTime: ev.endTime,
            location: ev.location || null,
            description: ev.description || null,
            eventType: ev.eventType,
            color: EVENT_TYPE_COLORS[ev.eventType] || "gray",
            confidence: ev.confidence,
            source: "gmail",
            sourceRef: ev.messageId ? `gmail:${ev.messageId}` : null,
            status: "pending",
          },
        });
        created.push(event);
      }

      await prisma.smartImportConfig.update({
        where: { id: configId },
        data: {
          lastScanAt: new Date(),
          lastScanStatus: "success",
          lastScanCount: created.length,
        },
      });

      return NextResponse.json({ count: created.length, events: created });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      await prisma.smartImportConfig.update({
        where: { id: configId },
        data: {
          lastScanStatus: "error",
          lastScanError: msg,
        },
      });

      // Check for scope error
      if (msg.includes("Insufficient Permission") || msg.includes("gmail")) {
        return NextResponse.json({
          error: "Gmail access not granted. Please sign out and sign back in to grant Gmail permissions.",
        }, { status: 403 });
      }

      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
