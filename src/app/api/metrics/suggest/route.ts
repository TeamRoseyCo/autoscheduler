import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai";
import { seedPresetMetrics } from "@/lib/actions/metrics";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title } = body;
  if (!title) return NextResponse.json({ metric: null });

  // Ensure user has metrics seeded
  await seedPresetMetrics(session.user.id);

  const metrics = await prisma.metricDefinition.findMany({
    where: { userId: session.user.id },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  if (metrics.length === 0) return NextResponse.json({ metric: null });

  try {
    const { client, model } = await getOpenAIClient(session.user.id);

    const metricList = metrics.map((m) => `${m.name} (${m.unit})`).join(", ");

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: `Given this task title: "${title}", which of these metrics best fits as a measurement for this task? Available metrics: ${metricList}. Return ONLY the exact metric name from the list, or "none" if no metric is appropriate. Do not explain.`,
        },
      ],
      max_tokens: 50,
    });

    const suggested = response.choices[0]?.message?.content?.trim() ?? "none";

    if (suggested === "none") return NextResponse.json({ metric: null });

    // Find the matching metric
    const match = metrics.find(
      (m) => m.name.toLowerCase() === suggested.toLowerCase()
    );

    if (!match) return NextResponse.json({ metric: null });

    return NextResponse.json({ metric: match });
  } catch {
    // AI not configured or failed — return null silently
    return NextResponse.json({ metric: null });
  }
}
