"use client";

import { useState, useEffect, useCallback } from "react";
import type { ImportEvent } from "./import-event-card";

interface Config {
  id: string;
  name: string;
  sourceType: string;
  enabled: boolean;
  gmailQuery: string | null;
  lastScanAt: string | null;
  lastScanStatus: string | null;
  lastScanError: string | null;
  lastScanCount: number;
  _count?: { pendingEvents: number };
}

interface EmailSourcesTabProps {
  onNewEvents: (events: ImportEvent[]) => void;
}

export function EmailSourcesTab({ onNewEvents }: EmailSourcesTabProps) {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleScan = useCallback(
    async (configId: string) => {
      setScanningId(configId);
      setError(null);

      try {
        const res = await fetch("/api/smart-import/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ configId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Scan failed");

        if (data.events?.length > 0) {
          onNewEvents(
            data.events.map((e: ImportEvent) => ({
              ...e,
              config: configs.find((c) => c.id === configId)
                ? { name: configs.find((c) => c.id === configId)!.name }
                : null,
            }))
          );
        }

        // Refresh configs to show updated scan status
        await fetchConfigs();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan failed");
      } finally {
        setScanningId(null);
      }
    },
    [configs, fetchConfigs, onNewEvents]
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
      {configs.length === 0 ? (
        <div className="text-center py-6 space-y-2">
          <div className="text-gray-500 text-sm">No email sources configured</div>
          <div className="text-gray-600 text-xs">
            Go to the Settings tab to add a Gmail source
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {configs.map((config) => (
            <div
              key={config.id}
              className="rounded-xl border border-[#2a2a3c] bg-[#1e1e30]/50 px-3 py-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <span className="truncate">{config.name}</span>
                  </div>
                  {config.gmailQuery && (
                    <div className="text-[10px] text-gray-600 mt-0.5 truncate font-mono">
                      {config.gmailQuery}
                    </div>
                  )}
                  {config.lastScanAt && (
                    <div className="text-[10px] text-gray-600 mt-0.5">
                      Last scan: {new Date(config.lastScanAt).toLocaleString()} ({config.lastScanCount} found)
                    </div>
                  )}
                  {config.lastScanStatus === "error" && config.lastScanError && (
                    <div className="text-[10px] text-red-400 mt-0.5 truncate">
                      Error: {config.lastScanError}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleScan(config.id)}
                  disabled={scanningId === config.id || !config.enabled}
                  className="ml-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {scanningId === config.id ? (
                    <>
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      Scan
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
