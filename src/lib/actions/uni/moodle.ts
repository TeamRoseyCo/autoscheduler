"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUniSettings } from "./settings";

// ── Moodle API helper ──────────────────────────────────────────────

const COURSE_COLORS = [
  "indigo", "rose", "emerald", "amber", "sky", "violet",
  "teal", "orange", "cyan", "pink", "lime", "fuchsia",
];

interface MoodleApiOptions {
  moodleUrl: string;
  token: string;
  wsfunction: string;
  params?: Record<string, string>;
}

async function callMoodleApi({ moodleUrl, token, wsfunction, params = {} }: MoodleApiOptions) {
  // Strip trailing slash from moodleUrl
  const baseUrl = moodleUrl.replace(/\/+$/, "");

  const body = new URLSearchParams({
    wstoken: token,
    wsfunction,
    moodlewsrestformat: "json",
    ...params,
  });

  // Pass moodlewsrestformat as a query param too — some Moodle instances
  // ignore the POST body value and return XML unless it's in the URL.
  const response = await fetch(
    `${baseUrl}/webservice/rest/server.php?moodlewsrestformat=json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    throw new Error(`Moodle HTTP ${response.status}`);
  }

  const text = await response.text();

  // Guard against XML / HTML responses (invalid token, wrong URL, etc.)
  if (text.startsWith("<?xml") || text.startsWith("<")) {
    throw new Error(
      "Moodle returned XML instead of JSON. Check that your Moodle URL and token are correct."
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Moodle returned invalid JSON: ${text.slice(0, 120)}`);
  }

  if (data?.exception) {
    throw new Error(data.message || data.exception);
  }

  return data;
}

// ── Get or resolve Moodle user ID ──────────────────────────────────

async function resolveMoodleUserId(
  moodleUrl: string,
  token: string,
  settingsUserId?: number | null
): Promise<number> {
  if (settingsUserId) return settingsUserId;

  // Auto-detect via site info
  const siteInfo = await callMoodleApi({
    moodleUrl,
    token,
    wsfunction: "core_webservice_get_site_info",
  });

  return siteInfo.userid;
}

// ── Determine semester from a course's start date ────────────────────

function getSemesterPeriod(startTimestamp: number): { name: string; startDate: Date; endDate: Date } {
  const date = new Date(startTimestamp * 1000);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  if (month >= 8) {
    // Sep–Jan → Fall/Winter semester
    return {
      name: `Fall ${year}`,
      startDate: new Date(year, 8, 1),
      endDate: new Date(year + 1, 1, 28),
    };
  } else if (month >= 1 && month <= 7) {
    // Feb–Aug → Spring/Summer semester
    return {
      name: `Spring ${year}`,
      startDate: new Date(year, 1, 1),
      endDate: new Date(year, 7, 31),
    };
  } else {
    // Jan → belongs to previous Fall
    return {
      name: `Fall ${year - 1}`,
      startDate: new Date(year - 1, 8, 1),
      endDate: new Date(year, 1, 28),
    };
  }
}

async function findOrCreateSemester(
  userId: string,
  period: { name: string; startDate: Date; endDate: Date }
): Promise<string> {
  // Check if a semester with this name already exists
  const existing = await prisma.uniSemester.findFirst({
    where: { userId, name: period.name },
  });

  if (existing) return existing.id;

  // Determine if this should be the "current" semester
  const now = new Date();
  const isCurrent = now >= period.startDate && now <= period.endDate;

  // If marking as current, unmark any other current semester
  if (isCurrent) {
    await prisma.uniSemester.updateMany({
      where: { userId, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  const semester = await prisma.uniSemester.create({
    data: {
      userId,
      name: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
      isCurrent,
    },
  });

  return semester.id;
}

async function ensureFallbackSemester(userId: string): Promise<string> {
  const existing = await prisma.uniSemester.findFirst({
    where: { userId, isCurrent: true },
  });
  if (existing) return existing.id;

  const now = new Date();
  const period = getSemesterPeriod(Math.floor(now.getTime() / 1000));

  return findOrCreateSemester(userId, period);
}

// ── Generate token from username/password ─────────────────────────

export async function generateMoodleToken(
  moodleUrl: string,
  username: string,
  password: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const baseUrl = moodleUrl.replace(/\/+$/, "").trim();

  const body = new URLSearchParams({
    username: username.trim(),
    password,
    service: "moodle_mobile_app",
  });

  const response = await fetch(`${baseUrl}/login/token.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await response.text();

  if (text.startsWith("<?xml") || text.startsWith("<")) {
    throw new Error("Invalid Moodle URL — got an HTML/XML page instead of API response.");
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid response from Moodle. Check your Moodle URL.");
  }

  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.token) {
    throw new Error("No token returned. Check your credentials.");
  }

  // Save the token + URL to settings
  await prisma.uniSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      moodleUrl: baseUrl,
      moodleToken: data.token,
    },
    update: {
      moodleUrl: baseUrl,
      moodleToken: data.token,
    },
  });

  return { success: true, token: data.token };
}

// ── Test connection ────────────────────────────────────────────────

export async function testMoodleConnection() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.moodleUrl || !settings?.moodleToken) {
    throw new Error("Moodle credentials not configured");
  }

  try {
    const siteInfo = await callMoodleApi({
      moodleUrl: settings.moodleUrl,
      token: settings.moodleToken,
      wsfunction: "core_webservice_get_site_info",
    });

    // Save the userId for future calls if not set
    if (!settings.moodleUserId && siteInfo.userid) {
      await prisma.uniSettings.update({
        where: { userId: session.user.id },
        data: { moodleUserId: siteInfo.userid },
      });
    }

    return { success: true, message: `Connected as ${siteInfo.fullname || siteInfo.username}` };
  } catch (error) {
    throw new Error(
      `Moodle connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ── Sync Courses ───────────────────────────────────────────────────

export async function syncMoodleCourses() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.moodleUrl || !settings?.moodleToken) {
    throw new Error("Moodle credentials not configured");
  }

  // Mark as syncing
  await prisma.uniMoodleSync.upsert({
    where: {
      userId_dataType: { userId: session.user.id, dataType: "courses" },
    },
    create: { userId: session.user.id, dataType: "courses", status: "syncing" },
    update: { status: "syncing", error: null },
  });

  try {
    const moodleUserId = await resolveMoodleUserId(
      settings.moodleUrl,
      settings.moodleToken,
      settings.moodleUserId
    );

    const courses = await callMoodleApi({
      moodleUrl: settings.moodleUrl,
      token: settings.moodleToken,
      wsfunction: "core_enrol_get_users_courses",
      params: { userid: moodleUserId.toString() },
    });

    if (!Array.isArray(courses)) {
      throw new Error("Unexpected Moodle response for courses");
    }

    // Fallback semester for courses without a start date
    const fallbackSemesterId = await ensureFallbackSemester(session.user.id);

    // Cache semester IDs by name to avoid repeated DB calls
    const semesterCache = new Map<string, string>();

    // Get existing courses to preserve colors
    const existingCourses = await prisma.uniCourse.findMany({
      where: { userId: session.user.id, moodleCourseId: { not: null } },
    });
    const existingByMoodleId = new Map(
      existingCourses.map((c) => [c.moodleCourseId, c])
    );

    let colorIndex = existingCourses.length;
    let imported = 0;

    for (const mc of courses) {
      // Skip hidden or site-level courses
      if (mc.visible === 0) continue;

      // Determine semester from Moodle course start date
      let semesterId = fallbackSemesterId;
      if (mc.startdate && mc.startdate > 0) {
        const period = getSemesterPeriod(mc.startdate);
        const cached = semesterCache.get(period.name);
        if (cached) {
          semesterId = cached;
        } else {
          semesterId = await findOrCreateSemester(session.user.id, period);
          semesterCache.set(period.name, semesterId);
        }
      }

      const existing = existingByMoodleId.get(mc.id);
      const courseName = mc.fullname || mc.displayname || mc.shortname || `Course ${mc.id}`;
      const courseCode = mc.shortname || `MOODLE-${mc.id}`;

      if (existing) {
        await prisma.uniCourse.update({
          where: { id: existing.id },
          data: {
            name: courseName,
            code: courseCode,
            semesterId,
          },
        });
      } else {
        const color = COURSE_COLORS[colorIndex % COURSE_COLORS.length];
        await prisma.uniCourse.create({
          data: {
            userId: session.user.id,
            semesterId,
            code: courseCode,
            name: courseName,
            moodleCourseId: mc.id,
            color,
            status: "active",
          },
        });
        colorIndex++;
      }

      imported++;
    }

    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "courses" },
      },
      data: { status: "success", lastSyncAt: new Date(), itemCount: imported },
    });

    return { success: true, message: `${imported} courses synced` };
  } catch (error) {
    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "courses" },
      },
      data: {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

// ── Sync Grades ────────────────────────────────────────────────────

export async function syncMoodleGrades() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.moodleUrl || !settings?.moodleToken) {
    throw new Error("Moodle credentials not configured");
  }

  await prisma.uniMoodleSync.upsert({
    where: {
      userId_dataType: { userId: session.user.id, dataType: "grades" },
    },
    create: { userId: session.user.id, dataType: "grades", status: "syncing" },
    update: { status: "syncing", error: null },
  });

  try {
    const moodleUserId = await resolveMoodleUserId(
      settings.moodleUrl,
      settings.moodleToken,
      settings.moodleUserId
    );

    // Get all synced courses
    const courses = await prisma.uniCourse.findMany({
      where: { userId: session.user.id, moodleCourseId: { not: null } },
    });

    let totalImported = 0;

    for (const course of courses) {
      if (!course.moodleCourseId) continue;

      try {
        const gradeReport = await callMoodleApi({
          moodleUrl: settings.moodleUrl,
          token: settings.moodleToken,
          wsfunction: "gradereport_user_get_grade_items",
          params: {
            courseid: course.moodleCourseId.toString(),
            userid: moodleUserId.toString(),
          },
        });

        const userGrades = gradeReport?.usergrades?.[0]?.gradeitems;
        if (!Array.isArray(userGrades)) continue;

        for (const item of userGrades) {
          // Skip category totals and course total
          if (item.itemtype === "category" || item.itemtype === "course") continue;

          const name = item.itemname || item.itemmodule || "Grade Item";
          const maxScore = item.grademax ?? 100;
          const score =
            item.graderaw != null && item.graderaw !== false
              ? Number(item.graderaw)
              : null;

          // Determine category from item module
          const category = item.itemmodule || null;

          // Weight from contribution to course total
          const weight = item.weightraw != null ? Number(item.weightraw) * 100 : null;

          // Check for existing grade item by name + course (avoid duplicates)
          const existingGrade = await prisma.uniGradeItem.findFirst({
            where: {
              userId: session.user.id,
              courseId: course.id,
              name,
            },
          });

          if (existingGrade) {
            // Update score if it changed
            if (score !== null && score !== existingGrade.score) {
              await prisma.uniGradeItem.update({
                where: { id: existingGrade.id },
                data: { score, maxScore, weight },
              });
            }
          } else {
            await prisma.uniGradeItem.create({
              data: {
                userId: session.user.id,
                courseId: course.id,
                name,
                category,
                maxScore,
                score,
                weight,
                date: item.gradedategraded
                  ? new Date(item.gradedategraded * 1000)
                  : null,
              },
            });
          }

          totalImported++;
        }
      } catch {
        // Some courses may not allow grade access — skip silently
        continue;
      }
    }

    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "grades" },
      },
      data: { status: "success", lastSyncAt: new Date(), itemCount: totalImported },
    });

    return { success: true, message: `${totalImported} grade items synced` };
  } catch (error) {
    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "grades" },
      },
      data: {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

// ── Sync Exams / Assignments ───────────────────────────────────────

export async function syncMoodleExams() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.moodleUrl || !settings?.moodleToken) {
    throw new Error("Moodle credentials not configured");
  }

  await prisma.uniMoodleSync.upsert({
    where: {
      userId_dataType: { userId: session.user.id, dataType: "exams" },
    },
    create: { userId: session.user.id, dataType: "exams", status: "syncing" },
    update: { status: "syncing", error: null },
  });

  try {
    // Get all synced courses
    const courses = await prisma.uniCourse.findMany({
      where: { userId: session.user.id, moodleCourseId: { not: null } },
    });

    if (courses.length === 0) {
      await prisma.uniMoodleSync.update({
        where: {
          userId_dataType: { userId: session.user.id, dataType: "exams" },
        },
        data: { status: "success", lastSyncAt: new Date(), itemCount: 0 },
      });
      return { success: true, message: "No courses to sync exams for" };
    }

    // Build courseids[] params
    const courseIdsParams: Record<string, string> = {};
    courses.forEach((c, i) => {
      if (c.moodleCourseId) {
        courseIdsParams[`courseids[${i}]`] = c.moodleCourseId.toString();
      }
    });

    const moodleCourseIdToLocal = new Map(
      courses.map((c) => [c.moodleCourseId!, c.id])
    );

    const result = await callMoodleApi({
      moodleUrl: settings.moodleUrl,
      token: settings.moodleToken,
      wsfunction: "mod_assign_get_assignments",
      params: courseIdsParams,
    });

    let totalImported = 0;

    const moodleCourses = result?.courses;
    if (!Array.isArray(moodleCourses)) {
      throw new Error("Unexpected Moodle response for assignments");
    }

    for (const mc of moodleCourses) {
      const localCourseId = moodleCourseIdToLocal.get(mc.id);
      if (!localCourseId) continue;

      const assignments = mc.assignments;
      if (!Array.isArray(assignments)) continue;

      for (const assign of assignments) {
        const title = assign.name || "Assignment";
        const dueDate = assign.duedate
          ? new Date(assign.duedate * 1000)
          : null;

        // Skip assignments with no due date or already past
        if (!dueDate) continue;

        // Determine type based on name heuristics
        let type: "exam" | "assignment" | "project" | "quiz" = "assignment";
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes("exam") || lowerTitle.includes("midterm") || lowerTitle.includes("final")) {
          type = "exam";
        } else if (lowerTitle.includes("quiz") || lowerTitle.includes("test")) {
          type = "quiz";
        } else if (lowerTitle.includes("project")) {
          type = "project";
        }

        // Check if this assignment already exists (by title + courseId + date)
        const existingExam = await prisma.uniExam.findFirst({
          where: {
            userId: session.user.id,
            courseId: localCourseId,
            title,
          },
        });

        if (existingExam) {
          // Update date if it changed
          if (dueDate.getTime() !== existingExam.date.getTime()) {
            await prisma.uniExam.update({
              where: { id: existingExam.id },
              data: { date: dueDate },
            });
          }
        } else {
          // Extract time from due date
          const hours = dueDate.getHours().toString().padStart(2, "0");
          const minutes = dueDate.getMinutes().toString().padStart(2, "0");
          const timeStr = `${hours}:${minutes}`;

          await prisma.uniExam.create({
            data: {
              userId: session.user.id,
              courseId: localCourseId,
              title,
              type,
              date: dueDate,
              time: timeStr !== "00:00" ? timeStr : null,
              notes: assign.intro
                ? assign.intro.replace(/<[^>]*>/g, "").slice(0, 500)
                : null,
              completed: false,
            },
          });
        }

        totalImported++;
      }
    }

    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "exams" },
      },
      data: { status: "success", lastSyncAt: new Date(), itemCount: totalImported },
    });

    return { success: true, message: `${totalImported} assignments/exams synced` };
  } catch (error) {
    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "exams" },
      },
      data: {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

// ── Sync Resources ─────────────────────────────────────────────────

export async function syncMoodleResources() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.moodleUrl || !settings?.moodleToken) {
    throw new Error("Moodle credentials not configured");
  }

  await prisma.uniMoodleSync.upsert({
    where: {
      userId_dataType: { userId: session.user.id, dataType: "resources" },
    },
    create: { userId: session.user.id, dataType: "resources", status: "syncing" },
    update: { status: "syncing", error: null },
  });

  try {
    const courses = await prisma.uniCourse.findMany({
      where: { userId: session.user.id, moodleCourseId: { not: null } },
    });

    let totalImported = 0;

    for (const course of courses) {
      if (!course.moodleCourseId) continue;

      try {
        // Get course contents (sections with modules)
        const sections = await callMoodleApi({
          moodleUrl: settings.moodleUrl,
          token: settings.moodleToken,
          wsfunction: "core_course_get_contents",
          params: { courseid: course.moodleCourseId.toString() },
        });

        if (!Array.isArray(sections)) continue;

        for (const section of sections) {
          const modules = section.modules;
          if (!Array.isArray(modules)) continue;

          for (const mod of modules) {
            // Only sync resource and URL modules
            if (mod.modname !== "resource" && mod.modname !== "url") continue;

            const title = mod.name || "Resource";
            const url =
              mod.modname === "url"
                ? mod.contents?.[0]?.fileurl || mod.url || null
                : mod.contents?.[0]?.fileurl || null;

            // Clean token from file URLs if present
            const cleanUrl = url?.replace(/[?&]token=[^&]+/, "") || null;

            const type = mod.modname === "url" ? "link" : "file";

            // Check for existing resource
            const existingResource = await prisma.uniResource.findFirst({
              where: {
                userId: session.user.id,
                courseId: course.id,
                title,
              },
            });

            if (!existingResource) {
              await prisma.uniResource.create({
                data: {
                  userId: session.user.id,
                  courseId: course.id,
                  title,
                  url: cleanUrl,
                  type,
                  category: section.name || null,
                },
              });
              totalImported++;
            }
          }
        }
      } catch {
        // Some courses may restrict access — skip silently
        continue;
      }
    }

    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "resources" },
      },
      data: { status: "success", lastSyncAt: new Date(), itemCount: totalImported },
    });

    return { success: true, message: `${totalImported} resources synced` };
  } catch (error) {
    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "resources" },
      },
      data: {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

// ── Sync All ───────────────────────────────────────────────────────

export async function syncAll() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  try {
    // Courses must be synced first so grades/exams can reference them
    const coursesResult = await syncMoodleCourses();
    const gradesResult = await syncMoodleGrades();
    const examsResult = await syncMoodleExams();
    const resourcesResult = await syncMoodleResources();

    return {
      success: true,
      message: [
        coursesResult.message,
        gradesResult.message,
        examsResult.message,
        resourcesResult.message,
      ].join("; "),
    };
  } catch (error) {
    throw new Error(
      `Sync failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
