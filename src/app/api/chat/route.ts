import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { getOpenAIClient } from "@/lib/openai";
import { autoScheduleTask, rescheduleAllTasks } from "@/lib/local-scheduler";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messages } = await req.json();
    const userId = session.user.id;

    const { client, model } = await getOpenAIClient(userId);

    const now = new Date();
    const todayKey = now.toISOString().split("T")[0];

    const [tasks, blocks, projects] = await Promise.all([
      prisma.task.findMany({
        where: { userId, completed: false },
        include: { project: { select: { name: true } } },
        orderBy: [{ priority: "asc" }, { deadline: "asc" }],
        take: 15,
      }),
      prisma.scheduledBlock.findMany({
        where: { userId, date: todayKey },
        orderBy: { startTime: "asc" },
        take: 10,
      }),
      prisma.project.findMany({
        where: { userId, status: "active" },
        select: { id: true, name: true },
        take: 10,
      }),
    ]);

    const fmtTime = (d: Date | string) =>
      new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const tasksSummary =
      tasks.length > 0
        ? tasks
            .map(
              (t) =>
                `  • [${t.priority.toUpperCase()}] "${t.title}" — ${t.durationMinutes}min, ${t.energyType}` +
                (t.deadline ? `, due ${new Date(t.deadline).toLocaleDateString()}` : "") +
                (t.project ? `, project: ${t.project.name}` : "")
            )
            .join("\n")
        : "  No active tasks";

    const scheduleSummary =
      blocks.length > 0
        ? blocks
            .map((b) => `  • ${fmtTime(b.startTime)}–${fmtTime(b.endTime)}: ${b.title}`)
            .join("\n")
        : "  Nothing scheduled yet today";

    const projectsSummary =
      projects.length > 0
        ? projects.map((p) => `  • ${p.name} (id: ${p.id})`).join("\n")
        : "  No active projects";

    const systemPrompt = `You are Cam 🦎, a friendly AI scheduling assistant embedded in an AI-powered calendar app. You have a warm, playful personality — curious and adaptable, just like a chameleon!

You help users manage tasks, schedule, and time. You can:
- Answer questions about their tasks and schedule
- Create new tasks using the create_task function
- Give actionable productivity and prioritization advice
- Help plan their day or week

Rules:
- Be concise. Don't ramble.
- Use a casual, friendly tone. Occasional emojis are fine but don't overdo it.
- If asked to create a task and details are unclear, make reasonable assumptions and mention them.
- Never hallucinate — if you don't know something, say so.

── Context ─────────────────────────────────────
Date/Time: ${now.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}

Active tasks (${tasks.length} total):
${tasksSummary}

Today's schedule:
${scheduleSummary}

Active projects:
${projectsSummary}
────────────────────────────────────────────────`;

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "create_task",
          description:
            "Create a new task for the user and auto-schedule it on their calendar. Use this when the user asks to add/create a task.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Clear, specific task title" },
              durationMinutes: {
                type: "number",
                description: "Estimated duration in minutes (5–480)",
              },
              priority: {
                type: "string",
                enum: ["asap", "high", "medium", "low"],
                description: "Task priority. Use 'asap' for urgent/immediate tasks.",
              },
              energyType: {
                type: "string",
                enum: ["deep", "light", "admin"],
                description:
                  "deep = focused work requiring concentration; light = easy or routine work; admin = meetings, emails, admin tasks",
              },
              deadline: {
                type: "string",
                description: "Optional deadline as YYYY-MM-DD",
              },
              projectId: {
                type: "string",
                description: "Optional project ID from the active projects list",
              },
            },
            required: ["title", "durationMinutes", "priority", "energyType"],
          },
        },
      },
    ];

    // First AI call — retry once after 2 s on 429
    const callParams = {
      model,
      messages: [{ role: "system" as const, content: systemPrompt }, ...messages],
      tools,
      tool_choice: "auto" as const,
      max_tokens: 700,
    };

    let firstResp;
    try {
      firstResp = await client.chat.completions.create(callParams);
    } catch (e) {
      const is429 =
        (e instanceof OpenAI.APIError && e.status === 429) ||
        (e instanceof Error && e.message.includes("429"));
      if (is429) {
        await new Promise((r) => setTimeout(r, 2000));
        firstResp = await client.chat.completions.create(callParams);
      } else {
        throw e;
      }
    }

    const firstChoice = firstResp.choices[0];
    const actions: { type: string; description: string; success: boolean }[] = [];
    let finalMessage: string;

    if (
      firstChoice.finish_reason === "tool_calls" &&
      firstChoice.message.tool_calls?.length
    ) {
      const createdTitles: string[] = [];
      const failedTitles: string[] = [];

      for (const toolCall of firstChoice.message.tool_calls) {
        if (toolCall.type !== "function") continue;
        if (toolCall.function.name === "create_task") {
          try {
            const args = JSON.parse(toolCall.function.arguments);

            const task = await prisma.task.create({
              data: {
                userId,
                title: args.title,
                durationMinutes: Math.min(480, Math.max(5, Math.round(args.durationMinutes))),
                priority: args.priority,
                energyType: args.energyType,
                deadline: args.deadline ? new Date(args.deadline) : null,
                projectId: args.projectId || null,
                taskStatus: "todo",
                completed: false,
              },
            });

            revalidatePath("/");
            revalidatePath("/tasks");

            createdTitles.push(args.title);
            actions.push({
              type: "task_created",
              description: `Created: "${args.title}"`,
              success: true,
            });
          } catch {
            const args = JSON.parse(toolCall.function.arguments);
            failedTitles.push(args.title ?? "unknown");
            actions.push({
              type: "task_created",
              description: "Failed to create task",
              success: false,
            });
          }
        }
      }

      // Reschedule all tasks in priority order after batch creation
      if (createdTitles.length > 0) {
        try {
          await rescheduleAllTasks(userId);
        } catch {
          // Non-blocking
        }
      }

      // Build response without a second API call to save rate-limit quota
      if (createdTitles.length > 0 && failedTitles.length === 0) {
        const list = createdTitles.map((t) => `"${t}"`).join(", ");
        finalMessage = `Done! ${createdTitles.length === 1 ? `Task ${list} has been created and scheduled. 🦎` : `Created and scheduled: ${list}. 🦎`}`;
      } else if (failedTitles.length > 0 && createdTitles.length === 0) {
        finalMessage = "Hmm, something went wrong creating the task. Try again?";
      } else {
        const ok = createdTitles.map((t) => `"${t}"`).join(", ");
        const fail = failedTitles.map((t) => `"${t}"`).join(", ");
        finalMessage = `Created ${ok}, but couldn't create ${fail}. Try again for the failed ones.`;
      }
    } else {
      finalMessage =
        firstChoice.message.content ?? "I'm not sure how to help with that.";
    }

    return NextResponse.json({ message: finalMessage, actions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Something went wrong";

    // Rate limit (Gemini free tier is 15 req/min — wait a moment and retry)
    if (
      (err instanceof OpenAI.APIError && err.status === 429) ||
      msg.includes("429") ||
      msg.toLowerCase().includes("rate limit") ||
      msg.toLowerCase().includes("quota")
    ) {
      return NextResponse.json({
        message:
          "I'm being rate-limited by the AI provider right now. Wait a few seconds and try again! 🦎 (Free Gemini keys allow ~15 requests/min.)",
        actions: [],
      });
    }

    // Friendly error for missing API key
    if (msg.includes("API key not configured") || msg.includes("openaiApiKey")) {
      return NextResponse.json({
        message:
          "I need an AI API key to work! Head to ⚙️ **Settings** and add your Gemini or OpenAI key — then I'm all yours. 🦎",
        actions: [],
      });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
