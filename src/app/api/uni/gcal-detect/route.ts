import { detectScheduleFromGCal, importDetectedClasses } from "@/lib/actions/uni/gcal-schedule-detect";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const schedule = await detectScheduleFromGCal();
    return NextResponse.json(schedule);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to detect schedule" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { classes } = await req.json();
    if (!Array.isArray(classes) || classes.length === 0) {
      return NextResponse.json({ error: "No classes provided" }, { status: 400 });
    }
    const result = await importDetectedClasses(classes);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import classes" },
      { status: 500 }
    );
  }
}
