import { redirect } from "next/navigation";
import { getUniSettings } from "@/lib/actions/uni/settings";
import { getSemesters } from "@/lib/actions/uni/semesters";
import { getCourses } from "@/lib/actions/uni/courses";
import { CourseList } from "@/components/uni/course-list";

export default async function CoursesPage() {
  const settings = await getUniSettings();
  if (!settings?.enabled) redirect("/uni/settings");

  const semesters = (await getSemesters()) ?? [];
  const courses = (await getCourses()) ?? [];

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <CourseList
          semesters={JSON.parse(JSON.stringify(semesters))}
          courses={JSON.parse(JSON.stringify(courses))}
        />
      </div>
    </div>
  );
}
