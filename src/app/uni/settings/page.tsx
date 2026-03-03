import { getUniSettings } from "@/lib/actions/uni/settings";
import { UniSettingsForm } from "@/components/uni/uni-settings-form";

export const metadata = {
  title: "University Tracker Settings",
};

export default async function UniSettingsPage() {
  const settings = await getUniSettings();

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">University Tracker Settings</h1>
          <p className="text-gray-400 mt-2">Configure your university tracker</p>
        </div>

        <UniSettingsForm initialSettings={settings} />
      </div>
    </div>
  );
}
