import { redirect } from "next/navigation";
import { getUniSettings } from "@/lib/actions/uni/settings";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { MoodlePanel } from "@/components/uni/moodle-panel";

export default async function MoodlePage() {
  const settings = await getUniSettings();
  if (!settings?.enabled) redirect("/uni/settings");

  const session = await auth();
  const syncHistory = session?.user?.id
    ? await prisma.uniMoodleSync.findMany({
        where: { userId: session.user.id },
        orderBy: { lastSyncAt: "desc" },
      })
    : [];

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        <MoodlePanel
          settings={JSON.parse(JSON.stringify(settings))}
          syncHistory={JSON.parse(JSON.stringify(syncHistory))}
        />
      </div>
    </div>
  );
}
