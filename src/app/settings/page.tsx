import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/actions/preferences";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/");

  const preferences = await getPreferences();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <SettingsForm preferences={preferences} />
      </div>
    </main>
  );
}
