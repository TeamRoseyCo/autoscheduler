import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messages, context } = await request.json();

    // Get user's AI preferences
    const prefs = await prisma.preferences.findFirst({
      where: { userId: session.user.id },
    });

    const provider = prefs?.aiProvider || "gemini";
    const systemPrompt = `You are a helpful university study assistant. You help students with study plans, flashcards, summaries, quizzes, and general academic advice.

Current context:
- Courses: ${context?.courses?.map((c: any) => `${c.code} (${c.name})`).join(", ") || "None"}
- Upcoming exams: ${context?.upcomingExams?.map((e: any) => `${e.title} for ${e.course} on ${e.date}`).join(", ") || "None"}

Be concise, helpful, and focused on academic success. Format your responses clearly with bullet points or numbered lists when appropriate.`;

    if (provider === "openai" && prefs?.openaiApiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${prefs.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: prefs.openaiModel || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((m: any) => ({ role: m.role, content: m.content })),
          ],
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        return NextResponse.json({ message: "Failed to get AI response. Check your API key." }, { status: 200 });
      }

      const data = await response.json();
      return NextResponse.json({ message: data.choices?.[0]?.message?.content || "No response generated." });
    }

    if (provider === "gemini") {
      // Use Gemini API if available
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const history = messages.map((m: any) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        }));

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: history,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return NextResponse.json({ message: text });
        }
      }
    }

    return NextResponse.json({
      message: "AI provider not configured. Please set up your AI provider (OpenAI or Gemini) in the main app Settings page to use the study assistant.",
    });
  } catch (error) {
    return NextResponse.json(
      { message: "An error occurred while processing your request." },
      { status: 200 }
    );
  }
}
