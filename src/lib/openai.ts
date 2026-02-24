import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

export async function getOpenAIClient(userId: string): Promise<{
  client: OpenAI;
  model: string;
}> {
  const preferences = await prisma.preferences.findUnique({
    where: { userId },
  });

  if (!preferences?.openaiApiKey) {
    throw new Error(
      "OpenAI API key not configured. Go to Settings to add your API key."
    );
  }

  return {
    client: new OpenAI({ apiKey: preferences.openaiApiKey }),
    model: preferences.openaiModel || "gpt-4o-mini",
  };
}
