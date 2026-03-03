import { redirect } from "next/navigation";
import { getUniSettings } from "@/lib/actions/uni/settings";
import { getCourses } from "@/lib/actions/uni/courses";
import { getExams } from "@/lib/actions/uni/exams";
import { AIStudyPanel } from "@/components/uni/ai-study-panel";

export default async function AIPage() {
  const settings = await getUniSettings();
  if (!settings?.enabled) redirect("/uni/settings");

  const [courses, exams] = await Promise.all([
    getCourses().then((r) => r ?? []),
    getExams({ completed: false }).then((r) => r ?? []),
  ]);

  const upcomingExams = exams.filter((e: any) => new Date(e.date) >= new Date()).slice(0, 5);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        <AIStudyPanel
          courses={JSON.parse(JSON.stringify(courses))}
          upcomingExams={JSON.parse(JSON.stringify(upcomingExams))}
        />
      </div>
    </div>
  );
}
