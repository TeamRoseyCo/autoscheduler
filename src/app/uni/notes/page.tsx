import { redirect } from "next/navigation";
import { getUniSettings } from "@/lib/actions/uni/settings";
import { getNotes } from "@/lib/actions/uni/notes";
import { getCourses } from "@/lib/actions/uni/courses";
import { NotesBrowser } from "@/components/uni/notes-browser";

export default async function NotesPage() {
  const settings = await getUniSettings();
  if (!settings?.enabled) redirect("/uni/settings");

  const [notes, courses] = await Promise.all([
    getNotes().then((r) => r ?? []),
    getCourses().then((r) => r ?? []),
  ]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <NotesBrowser
          notes={JSON.parse(JSON.stringify(notes))}
          courses={JSON.parse(JSON.stringify(courses))}
        />
      </div>
    </div>
  );
}
