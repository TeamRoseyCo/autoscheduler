"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

// Transform empty strings to undefined so optional numbers don't fail
const optionalNumber = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.coerce.number().optional()
);

const optionalString = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  z.string().optional()
);

const uniSettingsSchema = z.object({
  universityName: optionalString,
  studentName: optionalString,
  gradeScale: z.enum(["4.0", "4.3", "percentage", "custom"]).default("4.0"),
  targetGPA: optionalNumber,
  moodleUrl: optionalString,
  moodleToken: optionalString,
  moodleUserId: optionalNumber,
  stagUrl: optionalString,
  stagTicket: optionalString,
  stagOsCislo: optionalString,
  stagUser: optionalString,
  customScaleJson: optionalString,
  aiProvider: optionalString,
  aiApiKey: optionalString,
  aiModel: optionalString,
});

export async function getUniSettings() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const settings = await prisma.uniSettings.findUnique({
    where: { userId: session.user.id },
  });

  return settings;
}

export async function saveUniSettings(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = uniSettingsSchema.parse(raw);

  const settings = await prisma.uniSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  return settings;
}

export async function toggleUniPlugin(enabled: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settings = await prisma.uniSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, enabled },
    update: { enabled },
  });

  return settings;
}

export async function getUniDashboardData() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const settings = await prisma.uniSettings.findUnique({
    where: { userId: session.user.id },
  });

  if (!settings?.enabled) return null;

  // Get current semester
  const currentSemester = await prisma.uniSemester.findFirst({
    where: { userId: session.user.id, isCurrent: true },
    orderBy: { startDate: "desc" },
  });

  // Get upcoming exams (next 7 days)
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const upcomingExams = await prisma.uniExam.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: new Date(),
        lte: sevenDaysFromNow,
      },
      completed: false,
    },
    include: { course: true },
    orderBy: { date: "asc" },
    take: 5,
  });

  // Get today's classes
  const today = new Date();
  const dayOfWeek = today.getDay();

  const todaysClasses = await prisma.uniClassSlot.findMany({
    where: {
      userId: session.user.id,
      dayOfWeek,
    },
    include: { course: true },
    orderBy: { startTime: "asc" },
  });

  // Get all courses for current semester
  const courses = currentSemester
    ? await prisma.uniCourse.findMany({
        where: {
          userId: session.user.id,
          semesterId: currentSemester.id,
        },
      })
    : [];

  // Calculate semester GPA if grades exist
  let semesterGPA = null;
  if (courses.length > 0) {
    const gradeItems = await prisma.uniGradeItem.findMany({
      where: {
        userId: session.user.id,
        courseId: { in: courses.map((c) => c.id) },
        score: { not: null },
      },
    });

    if (gradeItems.length > 0) {
      const totalWeightedGPA = gradeItems.reduce((sum, item) => {
        if (item.weight) {
          const percentage = item.score! / item.maxScore;
          const gpa = convertPercentageToGPA(percentage, settings.gradeScale);
          return sum + gpa * item.weight;
        }
        return sum;
      }, 0);

      const totalWeight = gradeItems.reduce(
        (sum, item) => sum + (item.weight || 0),
        0
      );

      semesterGPA = totalWeight > 0 ? totalWeightedGPA / totalWeight : 0;
    }
  }

  // Get recent grades
  const recentGrades = await prisma.uniGradeItem.findMany({
    where: { userId: session.user.id },
    include: { course: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Calculate total credits
  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);

  return {
    settings,
    currentSemester,
    upcomingExams,
    todaysClasses,
    courses,
    semesterGPA,
    recentGrades,
    cumulativeGPA: semesterGPA, // same for now until multi-semester tracking
    totalCredits,
  };
}

function convertPercentageToGPA(
  percentage: number,
  gradeScale: string
): number {
  if (gradeScale === "percentage") return percentage;
  if (gradeScale === "4.3") {
    if (percentage >= 0.93) return 4.3;
    if (percentage >= 0.9) return 4.0;
    if (percentage >= 0.87) return 3.7;
    if (percentage >= 0.83) return 3.3;
    if (percentage >= 0.8) return 3.0;
    if (percentage >= 0.77) return 2.7;
    if (percentage >= 0.73) return 2.3;
    if (percentage >= 0.7) return 2.0;
    if (percentage >= 0.67) return 1.7;
    if (percentage >= 0.63) return 1.3;
    if (percentage >= 0.6) return 1.0;
    return 0;
  }
  // Default 4.0 scale
  if (percentage >= 0.93) return 4.0;
  if (percentage >= 0.9) return 3.7;
  if (percentage >= 0.87) return 3.3;
  if (percentage >= 0.83) return 3.0;
  if (percentage >= 0.8) return 2.7;
  if (percentage >= 0.77) return 2.3;
  if (percentage >= 0.73) return 2.0;
  if (percentage >= 0.7) return 1.7;
  if (percentage >= 0.67) return 1.3;
  if (percentage >= 0.63) return 1.0;
  return 0;
}
