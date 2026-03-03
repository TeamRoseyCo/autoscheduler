import { redirect } from "next/navigation";
import { getCourseDetail, getCourses } from "@/lib/actions/uni/courses";
import { getUniSettings } from "@/lib/actions/uni/settings";
import { getSemesters } from "@/lib/actions/uni/semesters";
import { CourseDetail } from "@/components/uni/course-detail";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const settings = await getUniSettings();
  if (!settings?.enabled) redirect("/uni/settings");

  const [course, semesters, courses] = await Promise.all([
    getCourseDetail(id),
    getSemesters().then((r) => r ?? []),
    getCourses().then((r) => r ?? []),
  ]);

  if (!course) redirect("/uni/courses");

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <CourseDetail
          course={JSON.parse(JSON.stringify(course))}
          semesters={JSON.parse(JSON.stringify(semesters))}
          courses={JSON.parse(JSON.stringify(courses))}
        />
      </div>
    </div>
  );
}
