import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH: update a config
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, gmailQuery, enabled } = body as {
    name?: string;
    gmailQuery?: string;
    enabled?: boolean;
  };

  const config = await prisma.smartImportConfig.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const updated = await prisma.smartImportConfig.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(gmailQuery !== undefined && { gmailQuery }),
      ...(enabled !== undefined && { enabled }),
    },
  });

  return NextResponse.json({ config: updated });
}

// DELETE: delete a config and its pending events
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const config = await prisma.smartImportConfig.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  // Delete pending events for this config first
  await prisma.smartImportEvent.deleteMany({
    where: { configId: id, status: "pending" },
  });

  await prisma.smartImportConfig.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
