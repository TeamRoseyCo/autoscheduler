"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGoogleCalendarClient } from "@/lib/google-auth";

const COURSE_COLORS = [
  "indigo", "blue", "green", "emerald", "teal",
  "purple", "pink", "rose", "amber", "orange",
];

interface DetectedClass {
  summary: string;
  dayOfWeek: number; // 0=Sun
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  location?: string;
  recurrenceCount: number; // how many times this exact slot repeats
}

export interface DetectedSchedule {
  classes: DetectedClass[];
  weekRange: string; // "Mar 2 - Mar 8, 2026"
}

/**
 * Scan Google Calendar for the current (or next) few weeks,
 * group events by summary+dayOfWeek+time, and return recurring patterns
 * that look like university classes.
 */
export async function detectScheduleFromGCal(): Promise<DetectedSchedule> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const calendar = await getGoogleCalendarClient(session.user.id);

  // Scan 4 weeks (current + next 3) to find recurring patterns
  const now = new Date();
  const scanStart = new Date(now);
  // Go to Monday of this week
  const day = scanStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  scanStart.setDate(scanStart.getDate() + mondayOffset);
  scanStart.setHours(0, 0, 0, 0);

  const scanEnd = new Date(scanStart);
  scanEnd.setDate(scanEnd.getDate() + 28); // 4 weeks

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: scanStart.toISOString(),
    timeMax: scanEnd.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 500,
  });

  const events = response.data.items || [];

  // Group events by a key: summary + dayOfWeek + startTime + endTime
  const groups = new Map<string, {
    summary: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location?: string;
    count: number;
  }>();

  for (const event of events) {
    if (!event.start?.dateTime || !event.end?.dateTime) continue;
    if (event.status === "cancelled") continue;
    if (!event.summary?.trim()) continue;

    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    const dow = start.getDay();
    const startHH = String(start.getHours()).padStart(2, "0");
    const startMM = String(start.getMinutes()).padStart(2, "0");
    const endHH = String(end.getHours()).padStart(2, "0");
    const endMM = String(end.getMinutes()).padStart(2, "0");
    const startTime = `${startHH}:${startMM}`;
    const endTime = `${endHH}:${endMM}`;

    const key = `${event.summary.trim()}|${dow}|${startTime}|${endTime}`;

    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      // Keep the first non-empty location
      if (!existing.location && event.location) {
        existing.location = event.location;
      }
    } else {
      groups.set(key, {
        summary: event.summary.trim(),
        dayOfWeek: dow,
        startTime,
        endTime,
        location: event.location || undefined,
        count: 1,
      });
    }
  }

  // Filter: only events that recur at least 2 times in 4 weeks are likely classes
  const classes: DetectedClass[] = [];
  for (const g of groups.values()) {
    if (g.count >= 2) {
      classes.push({
        summary: g.summary,
        dayOfWeek: g.dayOfWeek,
        startTime: g.startTime,
        endTime: g.endTime,
        location: g.location,
        recurrenceCount: g.count,
      });
    }
  }

  // Sort by dayOfWeek then startTime
  classes.sort((a, b) => {
    const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
    const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
    if (dayA !== dayB) return dayA - dayB;
    return a.startTime.localeCompare(b.startTime);
  });

  const weekEndDate = new Date(scanStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekRange = `${formatShortDate(scanStart)} - ${formatShortDate(scanEnd)}`;

  return { classes, weekRange };
}

function formatShortDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Import selected detected classes as UniCourses + UniClassSlots.
 * Groups by summary to create one course per unique name.
 */
export async function importDetectedClasses(
  classes: {
    summary: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location?: string;
    type?: string; // "lecture" | "lab" | "tutorial" | "seminar"
  }[]
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Ensure there's a current semester
  let semester = await prisma.uniSemester.findFirst({
    where: { userId: session.user.id, isCurrent: true },
  });

  if (!semester) {
    // Create a default semester
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const isSpring = month >= 1 && month <= 7;
    semester = await prisma.uniSemester.create({
      data: {
        userId: session.user.id,
        name: isSpring ? `Spring ${year}` : `Fall ${year}`,
        startDate: isSpring ? new Date(`${year}-02-01`) : new Date(`${year}-09-01`),
        endDate: isSpring ? new Date(`${year}-06-30`) : new Date(`${year + 1}-01-31`),
        isCurrent: true,
      },
    });
  }

  // Get existing courses for matching
  const existingCourses = await prisma.uniCourse.findMany({
    where: { userId: session.user.id, semesterId: semester.id },
  });

  // Track course names we've seen → courseId
  const courseMap = new Map<string, string>();
  for (const c of existingCourses) {
    courseMap.set(c.name.toLowerCase(), c.id);
    courseMap.set(c.code.toLowerCase(), c.id);
  }

  let usedColorIdx = existingCourses.length;
  let slotsCreated = 0;
  let coursesCreated = 0;

  for (const cls of classes) {
    // Try to find existing course by name match
    let courseId = courseMap.get(cls.summary.toLowerCase());

    if (!courseId) {
      // Check fuzzy: does the summary contain an existing course name or code?
      for (const c of existingCourses) {
        if (
          cls.summary.toLowerCase().includes(c.name.toLowerCase()) ||
          cls.summary.toLowerCase().includes(c.code.toLowerCase()) ||
          c.name.toLowerCase().includes(cls.summary.toLowerCase())
        ) {
          courseId = c.id;
          break;
        }
      }
    }

    if (!courseId) {
      // Create new course
      const color = COURSE_COLORS[usedColorIdx % COURSE_COLORS.length];
      usedColorIdx++;

      const course = await prisma.uniCourse.create({
        data: {
          userId: session.user.id,
          semesterId: semester.id,
          code: generateCourseCode(cls.summary),
          name: cls.summary,
          room: cls.location || null,
          color,
        },
      });

      courseId = course.id;
      courseMap.set(cls.summary.toLowerCase(), courseId);
      existingCourses.push(course);
      coursesCreated++;
    }

    // Check if this class slot already exists
    const existingSlot = await prisma.uniClassSlot.findFirst({
      where: {
        userId: session.user.id,
        courseId,
        dayOfWeek: cls.dayOfWeek,
        startTime: cls.startTime,
      },
    });

    if (!existingSlot) {
      await prisma.uniClassSlot.create({
        data: {
          userId: session.user.id,
          courseId,
          dayOfWeek: cls.dayOfWeek,
          startTime: cls.startTime,
          endTime: cls.endTime,
          location: cls.location || null,
          type: cls.type || "lecture",
        },
      });
      slotsCreated++;
    }
  }

  return {
    coursesCreated,
    slotsCreated,
    message: `Created ${coursesCreated} course${coursesCreated !== 1 ? "s" : ""} and ${slotsCreated} class slot${slotsCreated !== 1 ? "s" : ""}.`,
  };
}

/** Generate a short course code from a name, e.g. "Mathematics 101" → "MAT101" */
function generateCourseCode(name: string): string {
  // If name contains a slash (like "KMI/PROG1"), use it directly
  if (name.includes("/")) return name;

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 6).toUpperCase();
  }

  // Take first 3 chars of first word + any numbers
  const letters = words[0].substring(0, 3).toUpperCase();
  const numbers = name.match(/\d+/)?.[0] || "";
  return letters + numbers || words.map((w) => w[0]).join("").toUpperCase().substring(0, 6);
}
