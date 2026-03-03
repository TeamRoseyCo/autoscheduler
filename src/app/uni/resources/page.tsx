import { redirect } from "next/navigation";
import { getUniSettings } from "@/lib/actions/uni/settings";
import { getResources } from "@/lib/actions/uni/resources";
import { getCourses } from "@/lib/actions/uni/courses";
import { ResourcesList } from "@/components/uni/resources-list";

export default async function ResourcesPage() {
  const settings = await getUniSettings();
  if (!settings?.enabled) redirect("/uni/settings");

  const [resources, courses] = await Promise.all([
    getResources().then((r) => r ?? []),
    getCourses().then((r) => r ?? []),
  ]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <ResourcesList
          resources={JSON.parse(JSON.stringify(resources))}
          courses={JSON.parse(JSON.stringify(courses))}
        />
      </div>
    </div>
  );
}
