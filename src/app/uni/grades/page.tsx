import { redirect } from "next/navigation";
import { getUniSettings } from "@/lib/actions/uni/settings";
import { getGradeItems } from "@/lib/actions/uni/grades";
import { getCourses } from "@/lib/actions/uni/courses";
import { GradeTracker } from "@/components/uni/grade-tracker";

export default async function GradesPage() {
  const settings = await getUniSettings();
  if (!settings?.enabled) redirect("/uni/settings");

  const gradeItems = (await getGradeItems()) ?? [];
  const courses = (await getCourses()) ?? [];

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Grades</h1>
          <p className="text-gray-400 mt-2">Track your grades and GPA</p>
        </div>
        <GradeTracker grades={JSON.parse(JSON.stringify(gradeItems))} courses={JSON.parse(JSON.stringify(courses))} />
      </div>
    </div>
  );
}
