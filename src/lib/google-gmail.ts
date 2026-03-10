import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

export async function getGoogleGmailClient(userId: string) {
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

  // Persist refreshed tokens
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

  // Proactively refresh if expired or about to expire
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

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Scan Gmail for messages matching a query and return their subjects + body text.
 */
export async function scanGmailForEvents(
  userId: string,
  query: string,
  maxResults: number = 20,
  afterDate?: Date
): Promise<
  Array<{
    messageId: string;
    subject: string;
    from: string;
    date: string;
    bodyText: string;
    icsAttachments: string[];
  }>
> {
  const gmail = await getGoogleGmailClient(userId);

  // Append date filter if provided
  let fullQuery = query;
  if (afterDate) {
    const dateStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, "0")}/${String(afterDate.getDate()).padStart(2, "0")}`;
    fullQuery += ` after:${dateStr}`;
  }

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: fullQuery,
    maxResults,
  });

  const messageIds = listRes.data.messages?.map((m) => m.id!) || [];
  if (messageIds.length === 0) return [];

  const results: Array<{
    messageId: string;
    subject: string;
    from: string;
    date: string;
    bodyText: string;
    icsAttachments: string[];
  }> = [];

  for (const msgId of messageIds) {
    try {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: msgId,
        format: "full",
      });

      const headers = msg.data.payload?.headers || [];
      const subject =
        headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
      const from =
        headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
      const date =
        headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";

      // Extract body text
      let bodyText = "";
      const icsAttachments: string[] = [];

      const extractParts = (
        part: typeof msg.data.payload
      ) => {
        if (!part) return;

        // Check for ICS attachments
        if (
          part.filename &&
          (part.filename.endsWith(".ics") || part.mimeType === "text/calendar")
        ) {
          if (part.body?.data) {
            const decoded = Buffer.from(part.body.data, "base64").toString(
              "utf-8"
            );
            icsAttachments.push(decoded);
          }
        }

        // Extract text content
        if (part.mimeType === "text/plain" && part.body?.data) {
          bodyText += Buffer.from(part.body.data, "base64").toString("utf-8");
        }

        // Recurse into multipart
        if (part.parts) {
          for (const child of part.parts) {
            extractParts(child);
          }
        }
      };

      extractParts(msg.data.payload);

      // Truncate body for AI processing
      results.push({
        messageId: msgId,
        subject,
        from,
        date,
        bodyText: bodyText.slice(0, 3000),
        icsAttachments,
      });
    } catch (err) {
      console.error(`Failed to fetch Gmail message ${msgId}:`, err);
    }
  }

  return results;
}
