import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginScreen } from "@/components/login-screen";
import { WeekCalendar } from "@/components/week-calendar";
import { getProjects } from "@/lib/actions/projects";
import { redirect } from "next/navigation";
import type { ScheduledBlock } from "@/generated/prisma/client";

export default async function DashboardPage() {
  const needsSetup =
    !process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID === "your-google-client-id" ||
    !process.env.AUTH_SECRET ||
    process.env.AUTH_SECRET === "generate-a-random-secret-here";
  if (needsSetup) redirect("/setup");

  const session = await auth();
  if (!session?.user?.id) return <LoginScreen />;

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Calculate Sunday–Saturday for the current week
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const startDate = sunday.toISOString().split("T")[0];
  const endDate = saturday.toISOString().split("T")[0];

  const [blocks, projects] = await Promise.all([
    prisma.scheduledBlock.findMany({
      where: {
        userId: session.user.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { startTime: "asc" },
    }) as Promise<ScheduledBlock[]>,
    getProjects(),
  ]);

  return (
    <WeekCalendar
      initialBlocks={blocks}
      initialDate={todayStr}
      initialProjects={projects}
    />
  );
}
