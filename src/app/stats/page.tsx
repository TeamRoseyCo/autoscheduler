import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStatsData } from "@/lib/actions/metrics";
import { StatsPageClient } from "@/components/stats/stats-page-client";
import Link from "next/link";

export default async function StatsPage() {
  const session = await auth();
  if (!session) redirect("/");

  const data = await getStatsData("week");

  return (
    <main className="h-screen overflow-y-auto bg-[#0e0e1a]">
      {/* Subtle gradient backdrop */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-600/[0.03] rounded-full blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors group"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="transform group-hover:-translate-x-0.5 transition-transform"
            >
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Calendar
          </Link>
          <div className="w-px h-5 bg-gray-800" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">
            Dashboard
          </h1>
        </div>

        <StatsPageClient
          initialData={
            data
              ? {
                  timeByProject: data.timeByProject,
                  dailyHours: data.dailyHours,
                  metricSummaries: data.metricSummaries,
                }
              : null
          }
        />
      </div>
    </main>
  );
}
