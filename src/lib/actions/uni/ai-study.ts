"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

function createAIClient(apiKey: string, provider: string, model?: string | null): { client: OpenAI; model: string } {
  const isGemini = provider === "gemini";
  const resolvedModel = model || (isGemini ? "gemini-2.0-flash" : "gpt-4o-mini");

  return {
    client: new OpenAI({
      apiKey,
      ...(isGemini ? { baseURL: GEMINI_BASE_URL } : {}),
    }),
    model: resolvedModel,
  };
}

async function getUniAIClient(userId: string): Promise<{ client: OpenAI; model: string }> {
  // Try uni settings first
  const uniSettings = await prisma.uniSettings.findUnique({ where: { userId } });

  if (uniSettings?.aiApiKey) {
    return createAIClient(
      uniSettings.aiApiKey,
      uniSettings.aiProvider || "gemini",
      uniSettings.aiModel
    );
  }

  // Fall back to calendar app preferences
  const prefs = await prisma.preferences.findUnique({ where: { userId } });
  if (prefs?.openaiApiKey) {
    return createAIClient(
      prefs.openaiApiKey,
      prefs.aiProvider || "gemini",
      prefs.openaiModel
    );
  }

  throw new Error("AI API key not configured. Go to Uni Settings to add your API key.");
}

export async function generateStudyPlan(examId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const exam = await prisma.uniExam.findUnique({
    where: { id: examId },
    include: { course: true },
  });

  if (!exam) throw new Error("Exam not found");

  // Gather course context: notes, summaries, grade items
  const [notes, summaries, gradeItems] = await Promise.all([
    prisma.uniNote.findMany({
      where: { userId: session.user.id, courseId: exam.courseId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.uniClassSummary.findMany({
      where: { userId: session.user.id, courseId: exam.courseId },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.uniGradeItem.findMany({
      where: { userId: session.user.id, courseId: exam.courseId },
    }),
  ]);

  const daysUntilExam = Math.max(
    1,
    Math.ceil((exam.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const { client, model } = await getUniAIClient(session.user.id);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a study planning assistant. Create a detailed, actionable study plan. Use markdown formatting with headers, bullet points, and checkboxes.",
        },
        {
          role: "user",
          content: `Create a study plan for this exam:

**Exam:** ${exam.title}
**Course:** ${exam.course.code} — ${exam.course.name}
**Type:** ${exam.type}
**Date:** ${exam.date.toLocaleDateString()} (${daysUntilExam} days away)
**Weight:** ${exam.weight ? `${exam.weight}%` : "Unknown"}
${exam.notes ? `**Notes:** ${exam.notes}` : ""}

**Course topics covered (from class summaries):**
${summaries.map((s) => `- ${s.topics || "Untitled"}`).join("\n") || "No summaries available"}

**Notes available:**
${notes.map((n) => `- ${n.title}`).join("\n") || "No notes available"}

**Past grades in this course:**
${gradeItems.map((g) => `- ${g.name}: ${g.score != null ? `${g.score}/${g.maxScore}` : "not graded"}`).join("\n") || "No grade data"}

Create a day-by-day study plan that:
1. Distributes topics across the ${daysUntilExam} available days
2. Prioritizes weaker areas (based on past grades if available)
3. Includes review sessions and practice
4. Keeps sessions manageable (1-3 hours each)`,
        },
      ],
    });

    const plan = response.choices[0]?.message?.content || "Failed to generate plan";
    return { success: true, plan };
  } catch (e: any) {
    const msg = e?.message || String(e);
    throw new Error(`AI request failed: ${msg}`);
  }
}

export async function generateFlashcards(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const note = await prisma.uniNote.findUnique({
    where: { id: noteId },
    include: { course: true },
  });

  if (!note) throw new Error("Note not found");

  const { client, model } = await getUniAIClient(session.user.id);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            'You are a flashcard generator. Extract key concepts and create Q&A flashcards. Return ONLY valid JSON: an array of objects with "question" and "answer" fields. No markdown, no code fences.',
        },
        {
          role: "user",
          content: `Generate flashcards from this note:

**Title:** ${note.title}
${note.course ? `**Course:** ${note.course.code} — ${note.course.name}` : ""}
${note.tags ? `**Tags:** ${note.tags}` : ""}

**Content:**
${note.content}

Generate 5-15 flashcards covering the key concepts, definitions, and important details.`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content || "[]";

    let flashcards: { question: string; answer: string }[];
    try {
      const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      flashcards = JSON.parse(cleaned);
    } catch {
      flashcards = [{ question: "Could not parse AI response", answer: raw }];
    }

    return { success: true, flashcards };
  } catch (e: any) {
    const msg = e?.message || String(e);
    throw new Error(`AI request failed: ${msg}`);
  }
}

export async function summarizeNote(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const note = await prisma.uniNote.findUnique({
    where: { id: noteId },
    include: { course: true },
  });

  if (!note) throw new Error("Note not found");

  const { client, model } = await getUniAIClient(session.user.id);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a note summarizer. Create concise, well-structured summaries that capture key points. Use markdown formatting.",
        },
        {
          role: "user",
          content: `Summarize this note concisely:

**Title:** ${note.title}
${note.course ? `**Course:** ${note.course.code} — ${note.course.name}` : ""}

**Content:**
${note.content}

Provide:
1. A 2-3 sentence overview
2. Key points as bullet points
3. Any important definitions or formulas`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content || "Failed to summarize";
    return { success: true, summary };
  } catch (e: any) {
    const msg = e?.message || String(e);
    throw new Error(`AI request failed: ${msg}`);
  }
}

export async function generateClassSummary(summaryId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const summary = await prisma.uniClassSummary.findUnique({
    where: { id: summaryId },
    include: { course: true },
  });

  if (!summary) throw new Error("Summary not found");

  const { client, model } = await getUniAIClient(session.user.id);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an academic assistant. Enhance class summaries with clearer structure, key takeaways, and study questions. Use markdown formatting.",
        },
        {
          role: "user",
          content: `Enhance this class summary:

${summary.course ? `**Course:** ${summary.course.code} — ${summary.course.name}` : ""}
**Date:** ${summary.date.toLocaleDateString()}
**Type:** ${summary.type}
${summary.topics ? `**Topics:** ${summary.topics}` : ""}
${summary.summary ? `**Summary:** ${summary.summary}` : ""}
${summary.keyTakeaways ? `**Key Takeaways:** ${summary.keyTakeaways}` : ""}
${summary.questions ? `**Unanswered Questions:** ${summary.questions}` : ""}

Provide an enhanced version with:
1. Clear structured summary
2. Key takeaways as bullet points
3. Important concepts and definitions
4. Study questions for review`,
        },
      ],
    });

    const enhanced = response.choices[0]?.message?.content || "Failed to enhance";
    return { success: true, enhanced };
  } catch (e: any) {
    const msg = e?.message || String(e);
    throw new Error(`AI request failed: ${msg}`);
  }
}
