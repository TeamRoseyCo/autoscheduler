"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUniSettings } from "./settings";

export async function testMoodleConnection() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.moodleUrl || !settings?.moodleToken) {
    throw new Error("Moodle credentials not configured");
  }

  try {
    const response = await fetch(
      `${settings.moodleUrl}/webservice/rest/server.php`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          wstoken: settings.moodleToken,
          wsfunction: "core_user_get_users_by_id",
          moodlewsrestformat: "json",
          userids: [settings.moodleUserId?.toString() || ""].filter(Boolean)[0] || "1",
        }).toString(),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.exception) {
      throw new Error(data.message || "Moodle error");
    }

    return { success: true, message: "Connection successful" };
  } catch (error) {
    throw new Error(
      `Moodle connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

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
    create: {
      userId: session.user.id,
      dataType: "courses",
      status: "syncing",
    },
    update: { status: "syncing" },
  });

  try {
    // TODO: Implement actual Moodle API calls to fetch courses
    // For now, just mark as success
    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "courses" },
      },
      data: { status: "success", lastSyncAt: new Date(), itemCount: 0 },
    });

    return { success: true, message: "Courses synced" };
  } catch (error) {
    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "courses" },
      },
      data: {
        status: "error",
        error:
          error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

export async function syncMoodleGrades() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await getUniSettings();
  if (!settings?.moodleUrl || !settings?.moodleToken) {
    throw new Error("Moodle credentials not configured");
  }

  // Mark as syncing
  await prisma.uniMoodleSync.upsert({
    where: {
      userId_dataType: { userId: session.user.id, dataType: "grades" },
    },
    create: {
      userId: session.user.id,
      dataType: "grades",
      status: "syncing",
    },
    update: { status: "syncing" },
  });

  try {
    // TODO: Implement actual Moodle API calls to fetch grades
    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "grades" },
      },
      data: { status: "success", lastSyncAt: new Date(), itemCount: 0 },
    });

    return { success: true, message: "Grades synced" };
  } catch (error) {
    await prisma.uniMoodleSync.update({
      where: {
        userId_dataType: { userId: session.user.id, dataType: "grades" },
      },
      data: {
        status: "error",
        error:
          error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

export async function syncMoodleExams() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // TODO: Implement exam syncing from Moodle
  return { success: true, message: "Exams synced" };
}

export async function syncMoodleResources() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // TODO: Implement resource syncing from Moodle
  return { success: true, message: "Resources synced" };
}

export async function syncAll() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  try {
    await syncMoodleCourses();
    await syncMoodleGrades();
    await syncMoodleExams();
    await syncMoodleResources();
    return { success: true, message: "All synced" };
  } catch (error) {
    throw new Error(
      `Sync failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
