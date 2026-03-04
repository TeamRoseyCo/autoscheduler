import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  syncAll,
  syncMoodleCourses,
  syncMoodleGrades,
  syncMoodleExams,
  syncMoodleResources,
} from "@/lib/actions/uni/moodle";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const syncType = data.type || "all";

    let result;
    switch (syncType) {
      case "courses":
        result = await syncMoodleCourses();
        break;
      case "grades":
        result = await syncMoodleGrades();
        break;
      case "exams":
        result = await syncMoodleExams();
        break;
      case "resources":
        result = await syncMoodleResources();
        break;
      default:
        result = await syncAll();
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Sync failed",
      },
      { status: 400 }
    );
  }
}
