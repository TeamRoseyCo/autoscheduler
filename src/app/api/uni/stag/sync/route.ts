import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  syncStagCourses,
  syncStagGrades,
  syncStagExams,
  syncStagSchedule,
} from "@/lib/actions/uni/stag";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { type } = await request.json();

    switch (type) {
      case "courses": {
        const result = await syncStagCourses();
        return NextResponse.json(result);
      }
      case "grades": {
        const result = await syncStagGrades();
        return NextResponse.json(result);
      }
      case "exams": {
        const result = await syncStagExams();
        return NextResponse.json(result);
      }
      case "schedule": {
        const result = await syncStagSchedule();
        return NextResponse.json(result);
      }
      case "all": {
        const courses = await syncStagCourses();
        const grades = await syncStagGrades();
        const exams = await syncStagExams();
        const schedule = await syncStagSchedule();
        return NextResponse.json({
          success: true,
          message: [courses.message, grades.message, exams.message, schedule.message].join("; "),
        });
      }
      default:
        return NextResponse.json({ error: "Invalid sync type" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
