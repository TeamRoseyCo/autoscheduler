import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rescheduleOverdueTasks } from "@/lib/actions/reschedule";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await rescheduleOverdueTasks(session.user.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Reschedule failed";
    console.error("Reschedule error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
