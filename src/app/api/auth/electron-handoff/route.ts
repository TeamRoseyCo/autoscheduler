import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public endpoint used by the Electron app to retrieve the session token
 * after the user completes Google OAuth in the system browser.
 *
 * Since this is a localhost-only single-user app, we return the most
 * recently created valid session token. Electron sets this as a cookie
 * so it can authenticate against NextAuth.
 */
export async function GET() {
  try {
    const session = await prisma.session.findFirst({
      where: { expires: { gt: new Date() } },
      orderBy: { expires: "desc" },
      select: { sessionToken: true },
    });

    if (!session) {
      return NextResponse.json({ token: null });
    }

    return NextResponse.json({ token: session.sessionToken });
  } catch {
    return NextResponse.json({ token: null });
  }
}
