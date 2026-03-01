import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/actions/preferences";
import { SettingsForm } from "@/components/settings-form";
import Link from "next/link";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/");

  const preferences = await getPreferences();

  return (
    <main className="h-screen overflow-y-auto mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Calendar
        </Link>
        <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
      </div>
      <div className="rounded-lg bg-[#1e1e30] p-6 border border-[#2a2a3c]">
        <SettingsForm preferences={preferences} />
      </div>
    </main>
  );
}
