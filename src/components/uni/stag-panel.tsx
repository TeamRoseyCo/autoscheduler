"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { testStagConnection, disconnectStag } from "@/lib/actions/uni/stag";

interface StagPanelProps {
  settings: any;
}

const STAG_SYNC_TYPES = [
  { key: "courses", label: "Courses", icon: "📚", desc: "Import enrolled courses" },
  { key: "grades", label: "Grades", icon: "📊", desc: "Sync exam grades" },
  { key: "exams", label: "Exam Terms", icon: "📝", desc: "Import exam dates" },
  { key: "schedule", label: "Schedule", icon: "📅", desc: "Import timetable" },
];

// Default to UPOL, but allow custom
const DEFAULT_STAG_URL = "https://stagservices.upol.cz";

export function StagPanel({ settings }: StagPanelProps) {
  const router = useRouter();
  const [stagUrl, setStagUrl] = useState(settings?.stagUrl || DEFAULT_STAG_URL);
  const [ssoWaiting, setSsoWaiting] = useState(false);
  const [connectMode, setConnectMode] = useState<"sso" | "token">("sso");
  const [manualTicket, setManualTicket] = useState("");
  const [manualOsCislo, setManualOsCislo] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncAllRunning, setSyncAllRunning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isConnected = !!settings?.stagUrl && !!settings?.stagTicket;

  // Listen for SSO callback from popup
  const handleSsoMessage = useCallback(
    (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "stag_sso_complete" && event.data?.success) {
        setSsoWaiting(false);
        setMessage("Connected to STAG successfully!");
        setTimeout(() => setMessage(""), 5000);
        router.refresh();
      }
    },
    [router]
  );

  useEffect(() => {
    window.addEventListener("message", handleSsoMessage);
    return () => window.removeEventListener("message", handleSsoMessage);
  }, [handleSsoMessage]);

  const handleSsoSignIn = () => {
    if (!stagUrl) {
      setError("Enter your STAG URL first");
      return;
    }
    setError("");
    const cleanUrl = stagUrl.trim().replace(/\/+$/, "");

    // Store URL for callback page
    localStorage.setItem("stag_sso_url", cleanUrl);

    // STAG login redirects back to our callback page with the ticket
    const callbackUrl = `${window.location.origin}/stag-callback`;
    const loginUrl = `${cleanUrl}/ws/login?originalURL=${encodeURIComponent(callbackUrl)}&longTicket=1`;

    const popup = window.open(loginUrl, "stag_sso", "width=620,height=700,left=200,top=100");

    if (!popup) {
      setError("Popup was blocked. Please allow popups for this site and try again.");
      return;
    }

    setSsoWaiting(true);

    // Poll for popup close
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        setTimeout(() => {
          setSsoWaiting((w) => {
            if (w) return false;
            return w;
          });
        }, 500);
      }
    }, 500);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const result = await testStagConnection();
      setMessage(result.message);
      setTimeout(() => setMessage(""), 5000);
    } catch (e: any) {
      setError(e.message || "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleManualConnect = async () => {
    if (!stagUrl || !manualTicket) {
      setError("URL and ticket are required");
      return;
    }
    setConnecting(true);
    setError("");
    try {
      const cleanUrl = stagUrl.trim().replace(/\/+$/, "");
      // Auto-fix portal URL to API URL
      const apiUrl = cleanUrl.replace(/\/\/stag\.(?!services|ws)/, "//stagservices.");
      // Save directly — student number will be auto-detected on first sync
      const res = await fetch("/api/uni/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stagUrl: apiUrl,
          stagTicket: manualTicket.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMessage("Connected to STAG! Your student info will be detected on first sync.");
      setTimeout(() => setMessage(""), 5000);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Failed to connect");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect from STAG? Synced data will be kept.")) return;
    try {
      await disconnectStag();
      setStagUrl(DEFAULT_STAG_URL);
      router.refresh();
    } catch {}
  };

  const handleSync = async (type: string) => {
    setSyncing({ ...syncing, [type]: true });
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/uni/stag/sync", {
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
      const res = await fetch("/api/uni/stag/sync", {
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

  if (!isConnected) {
    return (
      <div className="p-6 rounded-lg bg-[#12121c] border border-[#2a2a3c] max-w-md">
        <h3 className="text-lg font-medium text-white mb-2">STAG (Student Agenda)</h3>
        <p className="text-sm text-gray-400 mb-4">
          Connect to IS/STAG to sync courses, grades, exams, and your timetable.
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
            onClick={() => setConnectMode("token")}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
              connectMode === "token"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Manual ticket
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">STAG Services URL</label>
            <input
              value={stagUrl}
              onChange={(e) => setStagUrl(e.target.value)}
              placeholder="https://stagservices.upol.cz"
              className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <p className="text-[10px] text-gray-600 mt-1">
              Pre-filled for UPOL. Change if you use a different university.
            </p>
          </div>

          {connectMode === "sso" ? (
            ssoWaiting ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-400">Waiting for you to sign in...</p>
                <p className="text-[10px] text-gray-600">Sign in on the popup window. It will close automatically.</p>
              </div>
            ) : (
              <>
                <button
                  onClick={handleSsoSignIn}
                  className="w-full px-4 py-3 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  Sign in to STAG
                </button>
                <p className="text-[10px] text-gray-500 text-center">
                  A popup will open with the STAG login page. Sign in with your university credentials.
                </p>
              </>
            )
          ) : (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ticket</label>
                <input
                  type="password"
                  value={manualTicket}
                  onChange={(e) => setManualTicket(e.target.value)}
                  placeholder="Your STAG login ticket"
                  className="w-full px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-gray-600 mt-1">
                  Paste the stagUserTicket from your STAG session. Your student number will be fetched automatically.
                </p>
              </div>
              <button
                onClick={handleManualConnect}
                disabled={connecting}
                className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                {connecting ? "Connecting..." : "Connect"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>
      )}
      {message && (
        <div className="mb-4 p-2 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">{message}</div>
      )}

      {/* Connection status */}
      <div className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c] mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <div>
            <span className="text-sm text-white font-medium">STAG Connected</span>
            {settings.stagOsCislo && (
              <span className="text-xs text-gray-500 ml-2">Student: {settings.stagOsCislo}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-3 py-1 text-xs text-blue-400 hover:bg-blue-500/10 rounded border border-blue-500/30 disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test"}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {STAG_SYNC_TYPES.map(({ key, label, icon, desc }) => {
          const isSyncing = syncing[key];
          return (
            <div key={key} className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <span className="text-white font-medium text-sm">{label}</span>
                </div>
                <button
                  onClick={() => handleSync(key)}
                  disabled={isSyncing}
                  className="px-3 py-1 text-xs bg-[#2a2a3c] hover:bg-[#3a3a4c] text-gray-300 rounded disabled:opacity-50"
                >
                  {isSyncing ? "Syncing..." : "Sync"}
                </button>
              </div>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSyncAll}
        disabled={syncAllRunning}
        className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
      >
        {syncAllRunning ? "Syncing All..." : "Sync All from STAG"}
      </button>
    </div>
  );
}
