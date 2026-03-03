"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ResourceFormModal } from "./resource-form-modal";

const TYPE_ICONS: Record<string, string> = {
  link: "🔗", file: "📄", textbook: "📚", video: "🎥", website: "🌐",
};

interface ResourcesListProps {
  resources: any[];
  courses: any[];
}

export function ResourcesList({ resources: initialResources, courses }: ResourcesListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showModal, setShowModal] = useState(false);
  const [editResource, setEditResource] = useState<any>(null);

  const filtered = useMemo(() => {
    return initialResources.filter((r: any) => {
      if (starredOnly && !r.starred) return false;
      if (courseFilter !== "all" && r.courseId !== courseFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.title.toLowerCase().includes(q) && !(r.notes || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [initialResources, search, courseFilter, typeFilter, starredOnly]);

  const handleToggleStar = async (resource: any) => {
    await fetch(`/api/uni/resources/${resource.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: !resource.starred }),
    });
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    await fetch(`/api/uni/resources/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditResource(null);
    router.refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Resources</h1>
        <button
          onClick={() => { setEditResource(null); setShowModal(true); }}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          + Add Resource
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resources..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
        />
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-gray-300 text-sm"
        >
          <option value="all">All Courses</option>
          {courses.map((c: any) => (
            <option key={c.id} value={c.id}>{c.code}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#12121c] border border-[#2a2a3c] text-gray-300 text-sm"
        >
          <option value="all">All Types</option>
          <option value="link">Link</option>
          <option value="file">File</option>
          <option value="textbook">Textbook</option>
          <option value="video">Video</option>
          <option value="website">Website</option>
        </select>
        <button
          onClick={() => setStarredOnly(!starredOnly)}
          className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
            starredOnly ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400" : "bg-[#12121c] border-[#2a2a3c] text-gray-500"
          }`}
        >
          Starred
        </button>
        <div className="flex border border-[#2a2a3c] rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-2 text-xs ${viewMode === "grid" ? "bg-[#2a2a3c] text-white" : "text-gray-500"}`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-2 text-xs ${viewMode === "list" ? "bg-[#2a2a3c] text-white" : "text-gray-500"}`}
          >
            List
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">No resources found</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((res: any) => (
            <div key={res.id} className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c] hover:bg-[#1a1a2e] transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{TYPE_ICONS[res.type] || "📄"}</span>
                  <span className="text-white font-medium line-clamp-1">{res.title}</span>
                </div>
                <button
                  onClick={() => handleToggleStar(res)}
                  className={`text-lg transition-colors ${res.starred ? "text-yellow-400" : "text-gray-600 hover:text-yellow-400"}`}
                >
                  {res.starred ? "★" : "☆"}
                </button>
              </div>
              {res.course && (
                <span className="text-[10px] font-mono text-gray-500">{res.course.code}</span>
              )}
              {res.url && (
                <a
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-400 hover:text-blue-300 truncate mt-1"
                >
                  {res.url}
                </a>
              )}
              {res.notes && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{res.notes}</p>
              )}
              <div className="flex gap-1 mt-3 pt-2 border-t border-[#2a2a3c]">
                <button
                  onClick={() => { setEditResource(res); setShowModal(true); }}
                  className="p-1 text-gray-500 hover:text-white rounded text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(res.id)}
                  className="p-1 text-gray-500 hover:text-red-400 rounded text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((res: any) => (
            <div key={res.id} className="flex items-center gap-4 p-3 rounded-lg bg-[#12121c] border border-[#2a2a3c] hover:bg-[#1a1a2e] transition-colors">
              <span className="text-lg">{TYPE_ICONS[res.type] || "📄"}</span>
              <div className="flex-1 min-w-0">
                <span className="text-white font-medium">{res.title}</span>
                {res.course && <span className="text-xs text-gray-500 ml-2">{res.course.code}</span>}
              </div>
              {res.url && (
                <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-[200px]">
                  {res.url}
                </a>
              )}
              <button onClick={() => handleToggleStar(res)} className={`${res.starred ? "text-yellow-400" : "text-gray-600"}`}>
                {res.starred ? "★" : "☆"}
              </button>
              <button onClick={() => { setEditResource(res); setShowModal(true); }} className="text-xs text-gray-500 hover:text-white">Edit</button>
              <button onClick={() => handleDelete(res.id)} className="text-xs text-gray-500 hover:text-red-400">Delete</button>
            </div>
          ))}
        </div>
      )}

      <ResourceFormModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditResource(null); }}
        onSaved={handleSaved}
        courses={courses}
        resource={editResource}
      />
    </div>
  );
}
