import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedPresetMetrics } from "@/lib/actions/metrics";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await seedPresetMetrics(session.user.id);

  const metrics = await prisma.metricDefinition.findMany({
    where: { userId: session.user.id },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(metrics);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, unit, icon, category, aggregation } = body;

  if (!name || !unit || !icon || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const metric = await prisma.metricDefinition.create({
    data: {
      userId: session.user.id,
      name,
      unit,
      icon,
      category,
      aggregation: aggregation ?? "sum",
      isPreset: false,
    },
  });

  return NextResponse.json(metric);
}
