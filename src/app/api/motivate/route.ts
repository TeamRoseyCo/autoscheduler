import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const firstName = session.user.name?.split(" ")[0] ?? null;
  const now = new Date();
  const hour = now.getHours();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = dayNames[now.getDay()];
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const todayStr = now.toISOString().split("T")[0];
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Gather context in parallel
  const [todayTasks, recentBlocks, recentMetrics, preferences] = await Promise.all([
    // All non-done tasks
    prisma.task.findMany({
      where: { userId, taskStatus: { notIn: ["completed", "cancelled"] } },
      select: { title: true, taskStatus: true, priority: true, deadline: true, energyType: true },
      orderBy: [{ priority: "asc" }, { deadline: "asc" }],
      take: 10,
    }),
    // Completed blocks from last 7 days
    prisma.scheduledBlock.findMany({
      where: {
        userId,
        status: "completed",
        startTime: { gte: sevenDaysAgo },
      },
      select: { title: true, startTime: true, endTime: true },
      orderBy: { startTime: "desc" },
      take: 20,
    }),
    // Recent metric entries
    prisma.metricEntry.findMany({
      where: { userId, date: { gte: sevenDaysAgo } },
      include: { metric: { select: { name: true, unit: true, icon: true } } },
      orderBy: { date: "desc" },
      take: 10,
    }),
    // User preferences (for timezone hint)
    prisma.preferences.findUnique({
      where: { userId },
      select: { openaiApiKey: true },
    }),
  ]);

  // Build context summary
  const todoCount = todayTasks.filter((t) => t.taskStatus === "todo").length;
  const inProgressCount = todayTasks.filter((t) => t.taskStatus === "in_progress").length;
  const topPriority = todayTasks.find((t) => t.priority === "asap" || t.priority === "high");

  // Today's completed work
  const todayCompleted = recentBlocks.filter(
    (b) => new Date(b.startTime).toISOString().split("T")[0] === todayStr
  );
  const todayMinutes = todayCompleted.reduce(
    (sum, b) => sum + Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000),
    0
  );

  // This week's completed blocks
  const weekMinutes = recentBlocks.reduce(
    (sum, b) => sum + Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000),
    0
  );

  // Recent metric highlights
  const metricLines = recentMetrics
    .slice(0, 3)
    .map((e) => `${e.metric.icon} ${e.metric.name}: ${e.value} ${e.metric.unit}`)
    .join(", ");

  const contextSummary = [
    `Time: ${timeOfDay} on ${todayName}`,
    firstName ? `User's first name: ${firstName}` : null,
    `Active tasks: ${todoCount} todo, ${inProgressCount} in progress`,
    topPriority ? `Top priority task: "${topPriority.title}"` : null,
    todayMinutes > 0 ? `Work done today: ${todayMinutes} minutes` : "No work logged yet today",
    weekMinutes > 0 ? `Work done this week: ${Math.round(weekMinutes / 60 * 10) / 10} hours` : null,
    metricLines ? `Recent metrics: ${metricLines}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { client, model } = await getOpenAIClient(userId);

    const systemPrompt = `You are Cam, a friendly AI scheduling assistant (represented as a chameleon). You send a short daily motivational message to the user based on their context. Keep it to 2-3 sentences max. Be specific to their situation — reference their actual tasks, metrics, or progress when relevant. Be warm, direct, and energizing — not generic. Don't use hollow phrases like "crush it" or "you've got this." Use 1 relevant emoji at the start. Vary the tone based on time of day: energetic in morning, focused in afternoon, reflective in evening.`;

    const userPrompt = `Here is today's context for the user:\n${contextSummary}\n\nWrite their daily motivational check-in message.`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 120,
    });

    const message = response.choices[0]?.message?.content?.trim() ?? null;
    if (!message) throw new Error("Empty response");

    return NextResponse.json({ message });
  } catch {
    // Fallback: simple time-based message without AI
    const fallbacks: Record<string, string> = {
      morning: `☀️ Good morning${firstName ? `, ${firstName}` : ""}! You have ${todoCount + inProgressCount} task${todoCount + inProgressCount !== 1 ? "s" : ""} ahead — let's make ${todayName} count.`,
      afternoon: `⚡ ${inProgressCount > 0 ? "You're in the middle of things" : `${todoCount} task${todoCount !== 1 ? "s" : ""} still on the list`} — keep that momentum going this afternoon.`,
      evening: `🌙 Wrapping up ${todayName}${todayMinutes > 0 ? ` — ${Math.round(todayMinutes / 60 * 10) / 10}h of work done today. Good effort` : ""}.`,
    };
    return NextResponse.json({ message: fallbacks[timeOfDay] });
  }
}
