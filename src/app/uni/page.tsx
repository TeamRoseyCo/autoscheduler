import { redirect } from "next/navigation";
import { getUniDashboardData } from "@/lib/actions/uni/settings";
import { UniDashboard } from "@/components/uni/uni-dashboard";

export const metadata = {
  title: "University Tracker",
};

export default async function UniDashboardPage() {
  const data = await getUniDashboardData();

  if (data === null) {
    redirect("/uni/settings");
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <UniDashboard data={JSON.parse(JSON.stringify(data))} />
      </div>
    </div>
  );
}
