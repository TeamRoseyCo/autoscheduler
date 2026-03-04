"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUniSettings } from "./settings";

// ── STAG API helper ──────────────────────────────────────────────────

interface StagApiOptions {
  stagUrl: string;
  ticket: string;
  service: string;
  operation: string;
  params?: Record<string, string>;
  stagUser?: string;
}

async function callStagApi({ stagUrl, ticket, service, operation, params = {}, stagUser }: StagApiOptions) {
  let baseUrl = stagUrl.replace(/\/+$/, "");

  // Auto-fix common URL mistakes: stag.upol.cz → stagservices.upol.cz
  // The portal (stag.X) is not the API — the API is at stagservices.X or stag-ws.X
  baseUrl = baseUrl.replace(/\/\/stag\.(?!services|ws)/, "//stagservices.");

  const searchParams = new URLSearchParams({
    ...params,
    outputFormat: "JSON",
    ...(stagUser ? { stagUser } : {}),
  });

  const url = `${baseUrl}/ws/services/rest2/${service}/${operation}?${searchParams.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: "Basic " + Buffer.from(ticket + ":").toString("base64"),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("STAG session expired. Please sign in again.");
    }
    throw new Error(`STAG API error: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`STAG returned invalid JSON: ${text.slice(0, 120)}`);
  }
}

// ── Save STAG ticket after login callback ────────────────────────────

export async function saveStagTicket(
  stagUrl: string,
  ticket: string,
  stagUserHint?: string,
  osCisloHint?: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const cleanUrl = stagUrl.replace(/\/+$/, "");

  // Use hints from the stagUserInfo param if available
  let stagUser = stagUserHint || "";
  let osCislo = osCisloHint || "";

  // If we don't have user info from the redirect, try fetching it
  if (!stagUser) {
    try {
      const rolesData = await callStagApi({
        stagUrl: cleanUrl,
        ticket,
        service: "help",
        operation: "getStagUserListForLoginTicket",
        params: { ticket },
      });

      const users = rolesData?.stagUserList?.stagUserInfo;
      const userList = Array.isArray(users) ? users : users ? [users] : [];

      for (const u of userList) {
        if (u.role === "ST" || u.userName) {
          stagUser = u.userName || stagUser;
          osCislo = u.osCislo || u.userName || osCislo;
        }
      }
    } catch {
      // If the API call fails, just save what we have from the redirect
    }
  }

  await prisma.uniSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      stagUrl: cleanUrl,
      stagTicket: ticket,
      stagOsCislo: osCislo || stagUser,
      stagUser: stagUser || osCislo,
    },
    update: {
      stagUrl: cleanUrl,
      stagTicket: ticket,
      stagOsCislo: osCislo || stagUser,
      stagUser: stagUser || osCislo,
    },
  });

  return { success: true, stagUser: stagUser || osCislo, osCislo: osCislo || stagUser };
}

// ── Auto-resolve student number if missing ───────────────────────────

async function resolveOsCislo(
  settings: { stagUrl: string; stagTicket: string; stagOsCislo?: string | null; stagUser?: string | null },
  userId: string
): Promise<{ osCislo: string; stagUser: string }> {
  if (settings.stagOsCislo) {
    return { osCislo: settings.stagOsCislo, stagUser: settings.stagUser || settings.stagOsCislo };
  }

  // Fetch from API
  const rolesData = await callStagApi({
    stagUrl: settings.stagUrl,
    ticket: settings.stagTicket,
    service: "help",
    operation: "getStagUserListForLoginTicket",
    params: { ticket: settings.stagTicket },
  });

  const users = rolesData?.stagUserList?.stagUserInfo;
  const userList = Array.isArray(users) ? users : users ? [users] : [];

  let osCislo = "";
  let stagUser = "";

  for (const u of userList) {
    if (u.role === "ST") {
      stagUser = u.userName || "";
      osCislo = u.osCislo || u.userName || "";
      break;
    }
  }

  if (!osCislo && userList.length > 0) {
    osCislo = userList[0].osCislo || userList[0].userName || "";
    stagUser = userList[0].userName || "";
  }

  if (!osCislo) {
    throw new Error("Could not detect your student number from STAG. Check your ticket.");
  }

  // Save for future use
  await prisma.uniSettings.update({
    where: { userId },
    data: { stagOsCislo: osCislo, stagUser: stagUser || osCislo },
  });

  return { osCislo, stagUser: stagUser || osCislo };
}

// ── Test connection ──────────────────────────────────────────────────

export async function testStagConnection() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.stagUrl || !settings?.stagTicket) {
    throw new Error("STAG not connected");
  }

  try {
    const info = await callStagApi({
      stagUrl: settings.stagUrl,
      ticket: settings.stagTicket,
      service: "help",
      operation: "getStagUserListForLoginTicket",
      params: { ticket: settings.stagTicket },
    });

    const users = info?.stagUserList?.stagUserInfo;
    const userList = Array.isArray(users) ? users : users ? [users] : [];
    const studentUser = userList.find((u: any) => u.role === "ST") || userList[0];

    return {
      success: true,
      message: `Connected as ${studentUser?.userName || "unknown"} (${studentUser?.role || "?"})`,
    };
  } catch (error) {
    throw new Error(
      `STAG connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ── Disconnect ───────────────────────────────────────────────────────

export async function disconnectStag() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.uniSettings.update({
    where: { userId: session.user.id },
    data: {
      stagUrl: null,
      stagTicket: null,
      stagOsCislo: null,
      stagUser: null,
    },
  });

  return { success: true };
}

// ── Sync Courses from STAG ───────────────────────────────────────────

export async function syncStagCourses() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.stagUrl || !settings?.stagTicket) {
    throw new Error("STAG not connected");
  }

  const { osCislo, stagUser } = await resolveOsCislo(settings as any, session.user.id);

  // Get current academic year info
  const now = new Date();
  const month = now.getMonth();
  const year = month >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  // Sync both semesters of current academic year
  const semesters = [
    { stagSemestr: "ZS", name: `Fall ${year}`, startDate: new Date(year, 8, 1), endDate: new Date(year + 1, 1, 28) },
    { stagSemestr: "LS", name: `Spring ${year + 1}`, startDate: new Date(year + 1, 1, 1), endDate: new Date(year + 1, 7, 31) },
  ];

  let totalImported = 0;

  const COURSE_COLORS = [
    "indigo", "rose", "emerald", "amber", "sky", "violet",
    "teal", "orange", "cyan", "pink", "lime", "fuchsia",
  ];

  const existingCourses = await prisma.uniCourse.findMany({
    where: { userId: session.user.id },
  });
  let colorIndex = existingCourses.length;

  for (const sem of semesters) {
    try {
      const data = await callStagApi({
        stagUrl: settings.stagUrl,
        ticket: settings.stagTicket,
        service: "predmety",
        operation: "getPredmetyByStudent",
        params: {
          osCislo,
          rok: year.toString(),
          semestr: sem.stagSemestr,
        },
        stagUser,
      });

      const courses = data?.predmetyStudenta?.predmetStudenta;
      const courseList = Array.isArray(courses) ? courses : courses ? [courses] : [];

      if (courseList.length === 0) continue;

      // Find or create semester
      let semester = await prisma.uniSemester.findFirst({
        where: { userId: session.user.id, name: sem.name },
      });

      if (!semester) {
        const isCurrent = now >= sem.startDate && now <= sem.endDate;
        if (isCurrent) {
          await prisma.uniSemester.updateMany({
            where: { userId: session.user.id, isCurrent: true },
            data: { isCurrent: false },
          });
        }
        semester = await prisma.uniSemester.create({
          data: {
            userId: session.user.id,
            name: sem.name,
            startDate: sem.startDate,
            endDate: sem.endDate,
            isCurrent: isCurrent,
          },
        });
      }

      for (const c of courseList) {
        const code = `${c.katedra}/${c.zkratka}`;
        const name = c.nazev || c.zkratka || "Unknown Course";
        const credits = c.kreditu ? parseInt(c.kreditu, 10) : null;

        // Check if already exists
        const existing = await prisma.uniCourse.findFirst({
          where: { userId: session.user.id, code },
        });

        if (existing) {
          await prisma.uniCourse.update({
            where: { id: existing.id },
            data: { name, semesterId: semester.id, credits },
          });
        } else {
          const color = COURSE_COLORS[colorIndex % COURSE_COLORS.length];
          await prisma.uniCourse.create({
            data: {
              userId: session.user.id,
              semesterId: semester.id,
              code,
              name,
              credits,
              color,
              status: "active",
            },
          });
          colorIndex++;
        }

        totalImported++;
      }
    } catch {
      // Semester might not have data, continue
      continue;
    }
  }

  return { success: true, message: `${totalImported} courses synced from STAG` };
}

// ── Sync Grades from STAG ────────────────────────────────────────────

export async function syncStagGrades() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.stagUrl || !settings?.stagTicket) {
    throw new Error("STAG not connected");
  }

  const { osCislo, stagUser } = await resolveOsCislo(settings as any, session.user.id);

  try {
    const data = await callStagApi({
      stagUrl: settings.stagUrl,
      ticket: settings.stagTicket,
      service: "znamky",
      operation: "getZnamkyByStudent",
      params: { osCislo },
      stagUser,
    });

    const grades = data?.studentZnam662?.znamkaInfo;
    const gradeList = Array.isArray(grades) ? grades : grades ? [grades] : [];

    let totalImported = 0;

    for (const g of gradeList) {
      const code = `${g.katedra}/${g.predmet}`;

      // Find matching course
      const course = await prisma.uniCourse.findFirst({
        where: { userId: session.user.id, code },
      });

      if (!course) continue;

      const name = g.nazevPredmetu || g.predmet || "Grade";
      const grade = g.znamka || null;

      // Check if exists
      const existing = await prisma.uniGradeItem.findFirst({
        where: { userId: session.user.id, courseId: course.id, name },
      });

      if (!existing) {
        await prisma.uniGradeItem.create({
          data: {
            userId: session.user.id,
            courseId: course.id,
            name,
            category: g.typZkousky || null,
            maxScore: 100,
            score: grade ? parseGradeToScore(grade) : null,
            date: g.datum ? new Date(g.datum) : null,
          },
        });
        totalImported++;
      }
    }

    return { success: true, message: `${totalImported} grades synced from STAG` };
  } catch (error) {
    throw new Error(
      `Grade sync failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ── Sync Exams from STAG ─────────────────────────────────────────────

export async function syncStagExams() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.stagUrl || !settings?.stagTicket) {
    throw new Error("STAG not connected");
  }

  const { osCislo, stagUser } = await resolveOsCislo(settings as any, session.user.id);

  try {
    const data = await callStagApi({
      stagUrl: settings.stagUrl,
      ticket: settings.stagTicket,
      service: "terminy",
      operation: "getTerminyProStudenta",
      params: { osCislo },
      stagUser,
    });

    const exams = data?.terminyPredmetu?.terminPredmetu;
    const examList = Array.isArray(exams) ? exams : exams ? [exams] : [];

    let totalImported = 0;

    for (const e of examList) {
      const code = `${e.katedra}/${e.zkratka}`;

      const course = await prisma.uniCourse.findFirst({
        where: { userId: session.user.id, code },
      });

      if (!course) continue;

      const title = `${e.typTerminu || "Exam"}: ${e.nazevPredmetu || e.zkratka}`;
      const dateStr = e.datum || e.datumKonani;
      if (!dateStr) continue;

      const examDate = new Date(dateStr);
      if (isNaN(examDate.getTime())) continue;

      const time = e.casOd || e.cas || null;

      // Check if exists
      const existing = await prisma.uniExam.findFirst({
        where: {
          userId: session.user.id,
          courseId: course.id,
          title,
        },
      });

      if (!existing) {
        await prisma.uniExam.create({
          data: {
            userId: session.user.id,
            courseId: course.id,
            title,
            type: "exam",
            date: examDate,
            time,
            location: e.budova && e.mistnost ? `${e.budova} ${e.mistnost}` : null,
            completed: false,
          },
        });
        totalImported++;
      }
    }

    return { success: true, message: `${totalImported} exam terms synced from STAG` };
  } catch (error) {
    throw new Error(
      `Exam sync failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ── Sync Schedule from STAG ──────────────────────────────────────────

export async function syncStagSchedule() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.stagUrl || !settings?.stagTicket) {
    throw new Error("STAG not connected");
  }

  const { osCislo, stagUser } = await resolveOsCislo(settings as any, session.user.id);

  const now = new Date();
  const month = now.getMonth();
  const year = month >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const semestr = month >= 8 || month === 0 ? "ZS" : "LS";

  try {
    const data = await callStagApi({
      stagUrl: settings.stagUrl,
      ticket: settings.stagTicket,
      service: "rozvrhy",
      operation: "getRozvrhByStudent",
      params: {
        osCislo,
        rok: year.toString(),
        semestr,
      },
      stagUser,
    });

    const events = data?.rozpisSemestru?.rozpisSemestruDen;
    const dayList = Array.isArray(events) ? events : events ? [events] : [];

    let totalImported = 0;
    const DAY_MAP: Record<string, number> = { PO: 1, UT: 2, ST: 3, CT: 4, PA: 5, SO: 6, NE: 0 };

    for (const day of dayList) {
      const slots = day.rozpisSemestruAkce;
      const slotList = Array.isArray(slots) ? slots : slots ? [slots] : [];

      for (const slot of slotList) {
        const code = `${slot.katedra}/${slot.predmet}`;
        const course = await prisma.uniCourse.findFirst({
          where: { userId: session.user.id, code },
        });

        if (!course) continue;

        const dayOfWeek = DAY_MAP[slot.den] ?? parseInt(slot.den, 10) ?? 1;

        // Check if class slot already exists
        const existing = await prisma.uniClassSlot.findFirst({
          where: {
            userId: session.user.id,
            courseId: course.id,
            dayOfWeek,
            startTime: slot.hodinaOd || slot.casOd || "08:00",
          },
        });

        if (!existing) {
          await prisma.uniClassSlot.create({
            data: {
              userId: session.user.id,
              courseId: course.id,
              dayOfWeek,
              startTime: slot.hodinaOd || slot.casOd || "08:00",
              endTime: slot.hodinaDo || slot.casDo || "09:30",
              location: slot.budova && slot.mistnost ? `${slot.budova} ${slot.mistnost}` : null,
              type: slot.typAkce === "Cv" ? "lab" : slot.typAkce === "Se" ? "seminar" : "lecture",
            },
          });
          totalImported++;
        }
      }
    }

    return { success: true, message: `${totalImported} schedule slots synced from STAG` };
  } catch (error) {
    throw new Error(
      `Schedule sync failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ── Helper: Convert Czech grade letter to numeric score ──────────────

function parseGradeToScore(grade: string): number | null {
  const map: Record<string, number> = {
    "A": 100, "B": 85, "C": 75, "D": 65, "E": 55, "F": 0,
    "1": 100, "2": 75, "3": 50, "4": 0,
    "výborně": 100, "velmi dobře": 75, "dobře": 50, "nevyhověl": 0,
    "prospěl": 100, "neprospěl": 0,
  };
  return map[grade.toLowerCase().trim()] ?? null;
}
