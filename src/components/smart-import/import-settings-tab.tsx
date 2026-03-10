"use client";

import { useState, useEffect, useCallback } from "react";

interface Config {
  id: string;
  name: string;
  sourceType: string;
  enabled: boolean;
  gmailQuery: string | null;
}

const GMAIL_PRESETS: Array<{ name: string; query: string }> = [
  { name: "Booking Confirmations", query: "subject:(booking OR confirmation OR reservation) newer_than:7d" },
  { name: "Flight & Travel", query: "subject:(flight OR boarding OR itinerary OR train OR ticket) newer_than:14d" },
  { name: "Meeting Invites", query: "filename:ics OR subject:(invite OR meeting) newer_than:3d" },
  { name: "Event Tickets", query: "subject:(ticket OR admission OR event) newer_than:14d" },
  { name: "All Recent", query: "newer_than:3d -category:promotions -category:social" },
];

export function ImportSettingsTab() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuery, setEditQuery] = useState("");

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/smart-import/configs");
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/smart-import/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          sourceType: "gmail",
          gmailQuery: newQuery.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");

      setNewName("");
      setNewQuery("");
      setShowCreate(false);
      await fetchConfigs();
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  }, [newName, newQuery, fetchConfigs]);

  const handleUpdate = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/smart-import/configs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            gmailQuery: editQuery.trim() || null,
          }),
        });
        setEditingId(null);
        await fetchConfigs();
      } catch {
        // silently fail
      }
    },
    [editName, editQuery, fetchConfigs]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/smart-import/configs/${id}`, { method: "DELETE" });
        await fetchConfigs();
      } catch {
        // silently fail
      }
    },
    [fetchConfigs]
  );

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      try {
        await fetch(`/api/smart-import/configs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
        await fetchConfigs();
      } catch {
        // silently fail
      }
    },
    [fetchConfigs]
  );

  if (loading) {
    return (
      <div className="px-4 py-8 flex justify-center">
        <span className="animate-spin inline-block w-5 h-5 border-2 border-gray-600 border-t-indigo-400 rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Existing configs */}
      {configs.length > 0 && (
        <div className="space-y-2">
          {configs.map((config) => (
            <div
              key={config.id}
              className="rounded-xl border border-[#2a2a3c] bg-[#1e1e30]/50 px-3 py-2.5"
            >
              {editingId === config.id ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Config name"
                    className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50"
                  />
                  <input
                    value={editQuery}
                    onChange={(e) => setEditQuery(e.target.value)}
                    placeholder="Gmail search query"
                    className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-2.5 py-1.5 text-xs text-gray-300 font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(config.id)}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">
                      {config.name}
                    </div>
                    {config.gmailQuery && (
                      <div className="text-[10px] text-gray-600 mt-0.5 truncate font-mono">
                        {config.gmailQuery}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <button
                      onClick={() => handleToggle(config.id, !config.enabled)}
                      className={`w-8 h-4 rounded-full transition-colors relative ${
                        config.enabled ? "bg-indigo-600" : "bg-gray-700"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                          config.enabled ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(config.id);
                        setEditName(config.name);
                        setEditQuery(config.gmailQuery || "");
                      }}
                      className="p-1 text-gray-500 hover:text-indigo-400 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create new config */}
      {showCreate ? (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-3 py-3 space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Config name (e.g. Work Email)"
            className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50"
            autoFocus
          />

          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">Gmail search query</label>
            <input
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              placeholder="e.g. subject:(booking OR confirmation) newer_than:7d"
              className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-2.5 py-1.5 text-xs text-gray-300 font-mono focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Presets */}
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">Quick presets</label>
            <div className="flex flex-wrap gap-1">
              {GMAIL_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    if (!newName.trim()) setNewName(preset.name);
                    setNewQuery(preset.query);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-[#2a2a3c] text-gray-400 hover:text-indigo-400 hover:border-indigo-500/40 transition-colors"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? "Creating..." : "Create Source"}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setNewName("");
                setNewQuery("");
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-2 rounded-xl border border-dashed border-[#2a2a3c] hover:border-indigo-500/40 text-gray-500 hover:text-indigo-400 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Email Source
        </button>
      )}

      <div className="text-[10px] text-gray-600 text-center pt-1">
        Gmail access requires re-signing in to grant permissions
      </div>
    </div>
  );
}
