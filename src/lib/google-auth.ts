import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

export async function getGoogleCalendarClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.access_token) {
    throw new Error("No Google account linked. Please sign in with Google.");
  }

  if (!account.refresh_token) {
    throw new Error(
      "No refresh token stored. Please sign out and sign in again to grant offline access."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // Listen for automatic token refresh — persist new tokens to DB
  oauth2Client.on("tokens", async (tokens) => {
    try {
      const data: Record<string, unknown> = {};
      if (tokens.access_token) data.access_token = tokens.access_token;
      if (tokens.refresh_token) data.refresh_token = tokens.refresh_token;
      if (tokens.expiry_date)
        data.expires_at = Math.floor(tokens.expiry_date / 1000);

      if (Object.keys(data).length > 0) {
        await prisma.account.update({ where: { id: account.id }, data });
      }
    } catch (e) {
      console.error("Failed to persist refreshed Google tokens:", e);
    }
  });

  // Proactively refresh if expired or about to expire (within 5 min)
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const isExpired =
    account.expires_at &&
    account.expires_at * 1000 < Date.now() + FIVE_MINUTES_MS;

  if (isExpired) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Google token refresh failed:", msg);

      // If the refresh token itself is invalid (revoked, expired for testing apps),
      // give a clear message
      if (
        msg.includes("invalid_grant") ||
        msg.includes("Token has been expired or revoked")
      ) {
        throw new Error(
          "Google refresh token expired or revoked. Please sign out and sign in again."
        );
      }
      throw new Error(`Google token refresh failed: ${msg}`);
    }
  }

  return google.calendar({ version: "v3", auth: oauth2Client });
}
