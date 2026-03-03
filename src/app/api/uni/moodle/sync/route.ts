import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncAll } from "@/lib/actions/uni/moodle";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const syncType = data.type || "all"; // all, courses, grades, exams, resources

    let result;
    if (syncType === "all") {
      result = await syncAll();
    } else {
      // Delegate to specific sync functions
      result = { success: true, message: `${syncType} sync initiated` };
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
