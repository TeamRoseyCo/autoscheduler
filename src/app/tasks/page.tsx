import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTasks } from "@/lib/actions/tasks";
import { TaskList } from "@/components/task-list";
import Link from "next/link";

export default async function TasksPage() {
  const session = await auth();
  if (!session) redirect("/");

  const [activeTasks, completedTasks] = await Promise.all([
    getTasks("active"),
    getTasks("completed"),
  ]);

  return (
    <main className="h-screen overflow-y-auto mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
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
        <h1 className="text-2xl font-bold text-gray-100">Tasks</h1>
      </div>
      <TaskList activeTasks={activeTasks} completedTasks={completedTasks} />
    </main>
  );
}
