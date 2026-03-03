import { redirect } from "next/navigation";
import { getUniSettings } from "@/lib/actions/uni/settings";
import { getSummaries } from "@/lib/actions/uni/summaries";
import { getCourses } from "@/lib/actions/uni/courses";
import { SummariesList } from "@/components/uni/summaries-list";

export default async function SummariesPage() {
  const settings = await getUniSettings();
  if (!settings?.enabled) redirect("/uni/settings");

  const [summaries, courses] = await Promise.all([
    getSummaries().then((r) => r ?? []),
    getCourses().then((r) => r ?? []),
  ]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <SummariesList
          summaries={JSON.parse(JSON.stringify(summaries))}
          courses={JSON.parse(JSON.stringify(courses))}
        />
      </div>
    </div>
  );
}
