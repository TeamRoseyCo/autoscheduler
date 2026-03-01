import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

export async function getOpenAIClient(userId: string): Promise<{
  client: OpenAI;
  model: string;
}> {
  const preferences = await prisma.preferences.findUnique({
    where: { userId },
  });

  if (!preferences?.openaiApiKey) {
    throw new Error(
      "AI API key not configured. Go to Settings to add your API key."
    );
  }

  const provider = preferences.aiProvider || "gemini";
  const model = preferences.openaiModel || (provider === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini");

  if (provider === "gemini") {
    return {
      client: new OpenAI({
        apiKey: preferences.openaiApiKey,
        baseURL: GEMINI_BASE_URL,
      }),
      model,
    };
  }

  // Default: OpenAI
  return {
    client: new OpenAI({ apiKey: preferences.openaiApiKey }),
    model,
  };
}
