import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

export async function getGoogleCalendarClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.access_token) {
    throw new Error("No Google account linked. Please sign in with Google.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  // Check if token is expired and refresh
  if (account.expires_at && account.expires_at * 1000 < Date.now()) {
    if (!account.refresh_token) {
      throw new Error(
        "Google token expired and no refresh token available. Please sign out and sign in again."
      );
    }

    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    // Update stored tokens
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date
          ? Math.floor(credentials.expiry_date / 1000)
          : null,
      },
    });
  }

  return google.calendar({ version: "v3", auth: oauth2Client });
}
