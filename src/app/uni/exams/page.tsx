import { redirect } from "next/navigation";
import { getUniSettings } from "@/lib/actions/uni/settings";
import { getExams } from "@/lib/actions/uni/exams";
import { getCourses } from "@/lib/actions/uni/courses";
import { ExamList } from "@/components/uni/exam-list";

export default async function ExamsPage() {
  const settings = await getUniSettings();
  if (!settings?.enabled) redirect("/uni/settings");

  const [exams, courses] = await Promise.all([
    getExams().then((r) => r ?? []),
    getCourses().then((r) => r ?? []),
  ]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <ExamList
          exams={JSON.parse(JSON.stringify(exams))}
          courses={JSON.parse(JSON.stringify(courses))}
        />
      </div>
    </div>
  );
}
