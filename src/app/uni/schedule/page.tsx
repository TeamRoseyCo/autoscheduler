import { redirect } from "next/navigation";
import { getUniSettings } from "@/lib/actions/uni/settings";
import { getAllClassSlots } from "@/lib/actions/uni/classSlots";
import { getCourses } from "@/lib/actions/uni/courses";
import { TimetableGrid } from "@/components/uni/timetable-grid";

export default async function SchedulePage() {
  const settings = await getUniSettings();
  if (!settings?.enabled) redirect("/uni/settings");

  const [slots, courses] = await Promise.all([
    getAllClassSlots().then((r) => r ?? []),
    getCourses().then((r) => r ?? []),
  ]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        <TimetableGrid
          slots={JSON.parse(JSON.stringify(slots))}
          courses={JSON.parse(JSON.stringify(courses))}
        />
      </div>
    </div>
  );
}
