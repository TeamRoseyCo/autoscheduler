import { auth } from "@/lib/auth";
import { getStatsData } from "@/lib/actions/metrics";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") ?? "week") as "week" | "month" | "year";

  const data = await getStatsData(range);
  return NextResponse.json(data);
}
