import { getWeekReview, getPreviousWeekReview } from "@/lib/actions/habits";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const weekStart = req.nextUrl.searchParams.get("weekStart");
  const previous = req.nextUrl.searchParams.get("previous");

  const data = previous === "true"
    ? await getPreviousWeekReview()
    : await getWeekReview(weekStart || undefined);

  return NextResponse.json(data);
}
