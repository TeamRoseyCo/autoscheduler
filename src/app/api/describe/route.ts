import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOpenAIClient } from "@/lib/openai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, goal, context, tone } = await req.json();
    const { client, model } = await getOpenAIClient(session.user.id);

    const toneGuide: Record<string, string> = {
      Brief: "ultra-concise, 1–2 sentences, punchy",
      Casual: "friendly and conversational, like a Slack message to a colleague",
      Professional: "clear and structured, suitable for a shared work calendar",
    };

    const systemPrompt = `You write short calendar event descriptions. Rules:
- 1–3 sentences max
- Weave in 2–4 relevant emojis naturally (not just at the start)
- Be specific — mention key actions, outcomes, people, or deliverables
- Tone: ${toneGuide[tone as string] ?? "concise"}
- Do NOT restate the event title
- Return ONLY the description text, nothing else`;

    const lines = [
      `Event: "${title}"`,
      goal ? `Goal: ${goal}` : null,
      context ? `Context/details: ${context}` : null,
    ].filter(Boolean).join("\n");

    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: lines },
      ],
      max_tokens: 140,
      temperature: 0.82,
    });

    const description = resp.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ description });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    if (msg.includes("API key not configured") || msg.includes("openaiApiKey")) {
      return NextResponse.json(
        { error: "Add your AI API key in ⚙️ Settings first" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
