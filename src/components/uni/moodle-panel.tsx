"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface MoodlePanelProps {
  settings: any;
  syncHistory: any[];
}

const SYNC_TYPES = [
  { key: "courses", label: "Courses", icon: "📚", desc: "Import courses from Moodle" },
  { key: "grades", label: "Grades", icon: "📊", desc: "Sync grade items and scores" },
  { key: "exams", label: "Assignments", icon: "📝", desc: "Import assignments as exams" },
  { key: "resources", label: "Resources", icon: "📁", desc: "Import course resources" },
];

export function MoodlePanel({ settings, syncHistory }: MoodlePanelProps) {
  const router = useRouter();
  const [moodleUrl, setMoodleUrl] = useState(settings?.moodleUrl || "");
  const [moodleToken, setMoodleToken] = useState(settings?.moodleToken || "");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncAllRunning, setSyncAllRunning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isConnected = !!settings?.moodleUrl && !!settings?.moodleToken;

  const handleConnect = async () => {
    if (!moodleUrl || !moodleToken) {
      setError("Both URL and token are required");
      return;
    }
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/uni/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodleUrl, moodleToken }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMessage("Connected to Moodle");
      setTimeout(() => setMessage(""), 3000);
      router.refresh();
    } catch {
      setError("Failed to connect");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect from Moodle? Synced data will be kept.")) return;
    try {
      await fetch("/api/uni/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodleUrl: "", moodleToken: "" }),
      });
      setMoodleUrl("");
      setMoodleToken("");
      router.refresh();
    } catch {}
  };

  const handleSync = async (type: string) => {
    setSyncing({ ...syncing, [type]: true });
    try {
      await fetch("/api/uni/moodle/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      router.refresh();
    } catch {} finally {
      setSyncing({ ...syncing, [type]: false });
    }
  };

  const handleSyncAll = async () => {
    setSyncAllRunning(true);
    try {
      await fetch("/api/uni/moodle/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "all" }),
      });
      router.refresh();
    } catch {} finally {
      setSyncAllRunning(false);
    }
  };

  // Get last sync info per type
  const lastSync = (type: string) => {
    const entry = syncHistory.find((s: any) => s.dataType === type);
    if (!entry) return null;
    return entry;
  };

  if (!isConnected) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-6">Moodle Integration</h1>

        <div className="p-6 rounded-lg bg-[#12121c] border border-[#2a2a3c] max-w-md">
          <h3 className="text-lg font-medium text-white mb-4">Connect to Moodle</h3>
          <p className="text-sm text-gray-400 mb-4">
            Link your Moodle LMS to automatically sync courses, grades, assignments, and resources.
          </p>

          {error && (
            <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Moodle URL</label>
              <input
                value={moodleUrl}
                onChange={(e) => setMoodleUrl(e.target.value)}
                placeholder="https://moodle.university.edu"
                className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Token</label>
              <input
                type="password"
                value={moodleToken}
                onChange={(e) => setMoodleToken(e.target.value)}
                placeholder="Your Moodle web service token"
                className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-600 mt-1">
                Generate in Moodle: Preferences &gt; Security keys &gt; Web service tokens
              </p>
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {connecting ? "Connecting..." : "Connect"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Moodle Integration</h1>
        <button
          onClick={handleSyncAll}
          disabled={syncAllRunning}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
        >
          {syncAllRunning ? "Syncing All..." : "Sync All"}
        </button>
      </div>

      {message && (
        <div className="mb-4 p-2 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">{message}</div>
      )}

      {/* Connection status */}
      <div className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c] mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <div>
            <span className="text-sm text-white font-medium">Connected</span>
            <span className="text-xs text-gray-500 ml-2">{settings.moodleUrl}</span>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded border border-red-500/30"
        >
          Disconnect
        </button>
      </div>

      {/* Sync cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {SYNC_TYPES.map(({ key, label, icon, desc }) => {
          const sync = lastSync(key);
          const isSyncing = syncing[key];
          return (
            <div key={key} className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <span className="text-white font-medium">{label}</span>
                </div>
                <button
                  onClick={() => handleSync(key)}
                  disabled={isSyncing}
                  className="px-3 py-1 text-xs bg-[#2a2a3c] hover:bg-[#3a3a4c] text-gray-300 rounded disabled:opacity-50"
                >
                  {isSyncing ? "Syncing..." : "Sync"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-2">{desc}</p>
              {sync && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className={sync.status === "success" ? "text-green-400" : "text-red-400"}>
                    {sync.status === "success" ? "Success" : "Error"}
                  </span>
                  <span className="text-gray-600">
                    {new Date(sync.lastSyncAt).toLocaleString()}
                  </span>
                  {sync.itemCount > 0 && (
                    <span className="text-gray-500">{sync.itemCount} items</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sync history */}
      {syncHistory.length > 0 && (
        <div className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Sync History</h3>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {syncHistory.map((entry: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[#2a2a3c]/50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${entry.status === "success" ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-gray-400 capitalize">{entry.dataType}</span>
                </div>
                <span className="text-gray-600">{new Date(entry.lastSyncAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
