import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: list all configs for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await prisma.smartImportConfig.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pendingEvents: { where: { status: "pending" } } } } },
  });

  return NextResponse.json({ configs });
}

// POST: create a new config
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, sourceType, gmailQuery } = body as {
    name: string;
    sourceType: string;
    gmailQuery?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const config = await prisma.smartImportConfig.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      sourceType: sourceType || "gmail",
      gmailQuery: gmailQuery || null,
    },
  });

  return NextResponse.json({ config });
}
