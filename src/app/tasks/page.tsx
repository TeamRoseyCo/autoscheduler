import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTasks } from "@/lib/actions/tasks";
import { TaskList } from "@/components/task-list";

export default async function TasksPage() {
  const session = await auth();
  if (!session) redirect("/");

  const [activeTasks, completedTasks] = await Promise.all([
    getTasks("active"),
    getTasks("completed"),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tasks</h1>
      <TaskList activeTasks={activeTasks} completedTasks={completedTasks} />
    </main>
  );
}
