"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateMoodleToken, testMoodleConnection } from "@/lib/actions/uni/moodle";

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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncAllRunning, setSyncAllRunning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [connectMode, setConnectMode] = useState<"sso" | "login" | "token">("sso");
  const [manualToken, setManualToken] = useState("");
  const [ssoStep, setSsoStep] = useState<"idle" | "waiting" | "token">("idle");

  const isConnected = !!settings?.moodleUrl && !!settings?.moodleToken;

  const ensureProtocol = (url: string) => {
    let clean = url.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(clean)) clean = "https://" + clean;
    return clean;
  };

  const handleSsoSignIn = () => {
    if (!moodleUrl) {
      setError("Enter your Moodle URL first");
      return;
    }
    setError("");
    const cleanUrl = ensureProtocol(moodleUrl);
    setMoodleUrl(cleanUrl);

    const popup = window.open(
      cleanUrl + "/login/index.php",
      "moodle_sso",
      "width=620,height=700,left=200,top=100"
    );

    if (!popup) {
      setError("Popup was blocked. Please allow popups for this site and try again.");
      return;
    }

    setSsoStep("waiting");

    // When popup closes, move to token step
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        setSsoStep("token");
      }
    }, 500);
  };

  const handleLoginConnect = async () => {
    if (!moodleUrl || !username || !password) {
      setError("URL, username, and password are all required");
      return;
    }
    setConnecting(true);
    setError("");
    try {
      await generateMoodleToken(moodleUrl.trim(), username.trim(), password);
      setMessage("Connected to Moodle successfully!");
      setPassword("");
      setTimeout(() => setMessage(""), 5000);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Failed to connect");
    } finally {
      setConnecting(false);
    }
  };

  const handleTokenConnect = async () => {
    if (!moodleUrl || !manualToken) {
      setError("Both URL and token are required");
      return;
    }
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/uni/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moodleUrl: moodleUrl.trim(),
          moodleToken: manualToken.trim(),
        }),
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

  const handleTestConnection = async () => {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const result = await testMoodleConnection();
      setMessage(result.message);
      setTimeout(() => setMessage(""), 5000);
    } catch (e: any) {
      setError(e.message || "Connection test failed");
    } finally {
      setTesting(false);
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
      setManualToken("");
      router.refresh();
    } catch {}
  };

  const handleSync = async (type: string) => {
    setSyncing({ ...syncing, [type]: true });
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/uni/moodle/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Sync failed (${res.status})`);
      } else {
        setMessage(data.message || "Sync complete");
        setTimeout(() => setMessage(""), 5000);
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Sync request failed");
    } finally {
      setSyncing({ ...syncing, [type]: false });
    }
  };

  const handleSyncAll = async () => {
    setSyncAllRunning(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/uni/moodle/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "all" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Sync failed (${res.status})`);
      } else {
        setMessage(data.message || "All synced");
        setTimeout(() => setMessage(""), 5000);
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Sync request failed");
    } finally {
      setSyncAllRunning(false);
    }
  };

  const lastSync = (type: string) => {
    return syncHistory.find((s: any) => s.dataType === type) || null;
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
          {message && (
            <div className="mb-4 p-2 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">{message}</div>
          )}

          {/* Mode toggle */}
          <div className="flex mb-4 bg-[#1e1e30] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setConnectMode("sso")}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                connectMode === "sso"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setConnectMode("login")}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                connectMode === "login"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Credentials
            </button>
            <button
              type="button"
              onClick={() => setConnectMode("token")}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                connectMode === "token"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Manual token
            </button>
          </div>

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

            {connectMode === "sso" ? (
              <>
                {ssoStep === "idle" && (
                  <>
                    <button
                      onClick={handleSsoSignIn}
                      className="w-full px-4 py-3 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      Sign in to Moodle
                    </button>
                    <p className="text-[10px] text-gray-500 text-center">
                      A popup will open so you can sign in with your university account.
                    </p>
                  </>
                )}
                {ssoStep === "waiting" && (
                  <div className="text-center py-4 space-y-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-gray-400">
                      Waiting for you to sign in...
                    </p>
                    <p className="text-[10px] text-gray-600">
                      Sign in on the popup window, then close it when you&apos;re done.
                    </p>
                  </div>
                )}
                {ssoStep === "token" && (
                  <>
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-300 mb-1">
                      Signed in! Now grab your API token to finish connecting.
                    </div>
                    <button
                      onClick={() => {
                        const cleanUrl = ensureProtocol(moodleUrl);
                        window.open(cleanUrl + "/user/managetoken.php", "moodle_sso", "width=620,height=700,left=200,top=100");
                      }}
                      className="w-full px-4 py-2.5 text-sm bg-[#2a2a3c] hover:bg-[#3a3a4c] text-white rounded-lg flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Open Token Page
                    </button>
                    <p className="text-[10px] text-gray-500">
                      Copy the <strong className="text-gray-400">Moodle mobile web service</strong> token and paste it below.
                    </p>
                    <div>
                      <input
                        type="password"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        placeholder="Paste your token here"
                        className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={handleTokenConnect}
                      disabled={connecting}
                      className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                    >
                      {connecting ? "Connecting..." : "Connect"}
                    </button>
                    <button
                      onClick={() => setSsoStep("idle")}
                      className="w-full text-xs text-gray-500 hover:text-gray-400"
                    >
                      Start over
                    </button>
                  </>
                )}
              </>
            ) : connectMode === "login" ? (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Username</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your Moodle username"
                    className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your Moodle password"
                    className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">
                    Your password is only used once to generate an API token. It is not stored.
                  </p>
                </div>
                <button
                  onClick={handleLoginConnect}
                  disabled={connecting}
                  className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {connecting ? "Connecting..." : "Connect"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">API Token</label>
                  <input
                    type="password"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Your Moodle web service token"
                    className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">
                    Find in Moodle: Preferences &gt; Security keys, or ask your Moodle admin.
                  </p>
                </div>
                <button
                  onClick={handleTokenConnect}
                  disabled={connecting}
                  className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {connecting ? "Connecting..." : "Connect"}
                </button>
              </>
            )}
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

      {error && (
        <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>
      )}
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-3 py-1 text-xs text-blue-400 hover:bg-blue-500/10 rounded border border-blue-500/30 disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={handleDisconnect}
            className="px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded border border-red-500/30"
          >
            Disconnect
          </button>
        </div>
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
