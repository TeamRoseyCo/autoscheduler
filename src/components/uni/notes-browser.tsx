"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

interface NotesBrowserProps {
  notes: any[];
  courses: any[];
}

export function NotesBrowser({ notes: initialNotes, courses }: NotesBrowserProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id || null);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editCourseId, setEditCourseId] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return initialNotes.filter((n: any) => {
      if (pinnedOnly && !n.pinned) return false;
      if (courseFilter !== "all" && n.courseId !== courseFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!n.title.toLowerCase().includes(q) && !n.content.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [initialNotes, search, courseFilter, pinnedOnly]);

  const selectedNote = initialNotes.find((n: any) => n.id === selectedId);

  const startEdit = (note?: any) => {
    if (note) {
      setEditTitle(note.title);
      setEditContent(note.content);
      setEditTags(note.tags || "");
      setEditCourseId(note.courseId || "");
    } else {
      setEditTitle("");
      setEditContent("");
      setEditTags("");
      setEditCourseId("");
    }
    setEditMode(true);
  };

  const handleNewNote = async () => {
    try {
      const res = await fetch("/api/uni/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Note", content: "" }),
      });
      const note = await res.json();
      setSelectedId(note.id);
      startEdit(note);
      router.refresh();
    } catch {}
  };

  const handleSave = async () => {
    if (!selectedId && !editTitle) return;
    setSaving(true);
    try {
      if (selectedId) {
        await fetch(`/api/uni/notes/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle,
            content: editContent,
            tags: editTags || null,
            courseId: editCourseId || null,
          }),
        });
      }
      setEditMode(false);
      router.refresh();
    } catch {} finally {
      setSaving(false);
    }
  };

  const handlePin = async () => {
    if (!selectedNote) return;
    await fetch(`/api/uni/notes/${selectedNote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !selectedNote.pinned }),
    });
    router.refresh();
  };

  const handleDelete = async () => {
    if (!selectedNote || !confirm("Delete this note?")) return;
    await fetch(`/api/uni/notes/${selectedNote.id}`, { method: "DELETE" });
    setSelectedId(null);
    setEditMode(false);
    router.refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Notes</h1>
        <button
          onClick={handleNewNote}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          + New Note
        </button>
      </div>

      <div className="flex gap-4 h-[calc(100vh-200px)]">
        {/* Left panel - note list */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-1">
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="flex-1 px-2 py-1 text-xs rounded bg-[#12121c] border border-[#2a2a3c] text-gray-300"
            >
              <option value="all">All Courses</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.code}</option>
              ))}
            </select>
            <button
              onClick={() => setPinnedOnly(!pinnedOnly)}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                pinnedOnly ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400" : "bg-[#12121c] border-[#2a2a3c] text-gray-500"
              }`}
            >
              Pinned
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No notes found</p>
            ) : (
              filtered.map((note: any) => (
                <button
                  key={note.id}
                  onClick={() => { setSelectedId(note.id); setEditMode(false); }}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedId === note.id
                      ? "bg-[#2a2a3c] text-white"
                      : "bg-[#12121c] text-gray-400 hover:bg-[#1a1a2e]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {note.pinned && <span className="text-yellow-400 text-xs">📌</span>}
                    <span className="font-medium text-sm truncate">{note.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {note.course && <span className="text-[10px] text-gray-500 font-mono">{note.course.code}</span>}
                    <span className="text-[10px] text-gray-600 truncate">{note.content?.slice(0, 40)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel - content */}
        <div className="flex-1 flex flex-col bg-[#12121c] rounded-lg border border-[#2a2a3c] overflow-hidden">
          {selectedNote ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a3c]">
                <div className="flex gap-1">
                  <button
                    onClick={() => editMode ? setEditMode(false) : startEdit(selectedNote)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      editMode ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-[#2a2a3c]"
                    }`}
                  >
                    {editMode ? "Preview" : "Edit"}
                  </button>
                </div>
                <div className="flex gap-1">
                  {editMode && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  )}
                  <button
                    onClick={handlePin}
                    className={`px-2 py-1 text-xs rounded ${selectedNote.pinned ? "text-yellow-400" : "text-gray-500"} hover:bg-[#2a2a3c]`}
                  >
                    {selectedNote.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {editMode ? (
                  <div className="space-y-3">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Note title"
                      className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-lg font-semibold focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-2">
                      <select
                        value={editCourseId}
                        onChange={(e) => setEditCourseId(e.target.value)}
                        className="px-2 py-1 text-xs rounded bg-[#1e1e30] border border-[#2a2a3c] text-gray-300"
                      >
                        <option value="">No course</option>
                        {courses.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.code}</option>
                        ))}
                      </select>
                      <input
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="Tags (comma-separated)"
                        className="flex-1 px-2 py-1 text-xs rounded bg-[#1e1e30] border border-[#2a2a3c] text-gray-300 focus:outline-none"
                      />
                    </div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="Write your notes here... (Markdown supported)"
                      className="w-full h-[calc(100%-120px)] min-h-[300px] px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">{selectedNote.title}</h2>
                    {selectedNote.tags && (
                      <div className="flex gap-1 mb-4 flex-wrap">
                        {selectedNote.tags.split(",").map((tag: string) => (
                          <span key={tag} className="text-xs bg-[#2a2a3c] text-gray-400 px-2 py-0.5 rounded">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{selectedNote.content || "*No content*"}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500">Select a note or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
