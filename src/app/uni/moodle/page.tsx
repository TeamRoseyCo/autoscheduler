import { redirect } from "next/navigation";
import { getUniSettings } from "@/lib/actions/uni/settings";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { MoodlePanel } from "@/components/uni/moodle-panel";
import { StagPanel } from "@/components/uni/stag-panel";

export default async function IntegrationsPage() {
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
      <div className="max-w-4xl mx-auto space-y-8">
        <MoodlePanel
          settings={JSON.parse(JSON.stringify(settings))}
          syncHistory={JSON.parse(JSON.stringify(syncHistory))}
        />

        <div className="border-t border-[#2a2a3c]" />

        <div>
          <h1 className="text-2xl font-bold text-white mb-6">STAG Integration</h1>
          <StagPanel settings={JSON.parse(JSON.stringify(settings))} />
        </div>
      </div>
    </div>
  );
}
