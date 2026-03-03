"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const examSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1),
  type: z
    .enum(["exam", "assignment", "project", "quiz"])
    .default("exam"),
  date: z.string(),
  time: z.string().optional(),
  location: z.string().optional(),
  weight: z.coerce.number().optional(),
  notes: z.string().optional(),
  completed: z.boolean().default(false),
});

export async function getExams(filters?: { completed?: boolean; courseId?: string }) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const where: any = { userId: session.user.id };
  if (filters?.completed !== undefined) {
    where.completed = filters.completed;
  }
  if (filters?.courseId) {
    where.courseId = filters.courseId;
  }

  return prisma.uniExam.findMany({
    where,
    include: { course: true },
    orderBy: { date: "asc" },
  });
}

export async function createExam(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = examSchema.parse(raw);

  const exam = await prisma.uniExam.create({
    data: {
      ...data,
      date: new Date(data.date),
      userId: session.user.id,
    },
    include: { course: true },
  });

  // Trigger calendar sync
  await syncExamToCalendar(exam.id);

  return exam;
}

export async function updateExam(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const raw = Object.fromEntries(formData.entries());
  const data = examSchema.parse(raw);

  const exam = await prisma.uniExam.update({
    where: { id },
    data: {
      ...data,
      date: new Date(data.date),
    },
    include: { course: true },
  });

  // Re-sync calendar
  await syncExamToCalendar(exam.id);

  return exam;
}

export async function deleteExam(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const exam = await prisma.uniExam.findUnique({
    where: { id },
  });

  if (exam?.calendarBlockId) {
    await prisma.scheduledBlock.delete({
      where: { id: exam.calendarBlockId },
    }).catch(() => null); // ignore if not found
  }

  if (exam?.studyTaskId) {
    await prisma.task.delete({
      where: { id: exam.studyTaskId },
    }).catch(() => null); // ignore if not found
  }

  return prisma.uniExam.delete({
    where: { id },
  });
}

export async function toggleExamComplete(id: string, completed: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const exam = await prisma.uniExam.update({
    where: { id },
    data: { completed },
  });

  return exam;
}

// Internal function for syncing exam to calendar
export async function syncExamToCalendar(examId: string) {
  const exam = await prisma.uniExam.findUnique({
    where: { id: examId },
    include: { course: true },
  });

  if (!exam) throw new Error("Exam not found");

  // Delete existing ScheduledBlock if it exists
  if (exam.calendarBlockId) {
    await prisma.scheduledBlock.delete({
      where: { id: exam.calendarBlockId },
    }).catch(() => null);
  }

  // Delete existing Task if it exists
  if (exam.studyTaskId) {
    await prisma.task.delete({
      where: { id: exam.studyTaskId },
    }).catch(() => null);
  }

  // Create new ScheduledBlock for exam
  const startTime = exam.time ? parseTimeToDateTime(exam.date, exam.time) : exam.date;
  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + 2); // default 2-hour exam

  const scheduledBlock = await prisma.scheduledBlock.create({
    data: {
      userId: exam.userId,
      title: `📝 ${exam.title}`,
      startTime,
      endTime,
      date: exam.date.toISOString().split("T")[0],
      color: exam.course.color,
      status: "scheduled",
      location: exam.location,
    },
  });

  // Create new Task for study (1 day before exam)
  const studyDeadline = new Date(exam.date);
  studyDeadline.setDate(studyDeadline.getDate() - 1);

  const studyTask = await prisma.task.create({
    data: {
      userId: exam.userId,
      title: `Study for ${exam.title}`,
      durationMinutes: 120,
      deadline: studyDeadline,
      priority: "high",
      energyType: "deep",
      taskStatus: "todo",
    },
  });

  // Update exam with calendar block and task IDs
  await prisma.uniExam.update({
    where: { id: examId },
    data: {
      calendarBlockId: scheduledBlock.id,
      studyTaskId: studyTask.id,
    },
  });
}

function parseTimeToDateTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}
