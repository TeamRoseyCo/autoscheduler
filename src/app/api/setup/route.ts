import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { randomBytes } from "crypto";
import path from "path";

export async function POST(request: Request) {
  const { clientId, clientSecret } = await request.json();

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const authSecret = randomBytes(32).toString("hex");

  const envContent = `# Google OAuth
GOOGLE_CLIENT_ID=${clientId}
GOOGLE_CLIENT_SECRET=${clientSecret}

# NextAuth
AUTH_SECRET=${authSecret}
AUTH_URL=http://localhost:3000

# Database
DATABASE_URL="file:./dev.db"
`;

  const envPath = path.join(process.cwd(), ".env.local");
  await writeFile(envPath, envContent, "utf-8");

  return NextResponse.json({ success: true });
}
