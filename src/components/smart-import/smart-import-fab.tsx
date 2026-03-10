"use client";

import { useState, useEffect, useCallback } from "react";
import { QuickImportTab } from "./quick-import-tab";
import { EmailSourcesTab } from "./email-sources-tab";
import { ImportSettingsTab } from "./import-settings-tab";
import { ApprovalQueue } from "./approval-queue";
import type { ImportEvent } from "./import-event-card";

type TabKey = "quick" | "email" | "settings";

interface SmartImportFABProps {
  onImported: () => void;
}

export function SmartImportFAB({ onImported }: SmartImportFABProps) {
  const [active, setActive] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("quick");
  const [pendingEvents, setPendingEvents] = useState<ImportEvent[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loadedPending, setLoadedPending] = useState(false);

  // Persist active state
  useEffect(() => {
    const saved = localStorage.getItem("smart-import-active");
    if (saved === "true") setActive(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("smart-import-active", String(active));
  }, [active]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Load pending events from DB when panel opens
  useEffect(() => {
    if (!panelOpen || loadedPending) return;

    async function loadPending() {
      try {
        const res = await fetch("/api/smart-import/events");
        const data = await res.json();
        if (data.events?.length > 0) {
          setPendingEvents(data.events);
        }
      } catch {
        // silently fail
      }
      setLoadedPending(true);
    }

    loadPending();
  }, [panelOpen, loadedPending]);

  const handleNewEvents = useCallback((events: ImportEvent[]) => {
    setPendingEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const newOnes = events.filter((e) => !existingIds.has(e.id));
      return [...newOnes, ...prev];
    });
  }, []);

  const handleApproved = useCallback(() => {
    const remaining = pendingEvents.length;
    setToast(`Added events to calendar`);
    onImported();
  }, [pendingEvents, onImported]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "quick", label: "Quick Import" },
    { key: "email", label: "Email Sources" },
    { key: "settings", label: "Settings" },
  ];

  // Inactive state: small enable button
  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="fixed bottom-[76px] right-[10px] z-40 w-12 h-12 rounded-full bg-[#1e1e30] border border-[#2a2a3c] text-gray-500 hover:text-indigo-400 hover:border-indigo-500/50 shadow-lg transition-all flex items-center justify-center"
        title="Enable Smart Import"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className={`fixed bottom-[76px] right-4 z-40 w-14 h-14 rounded-full shadow-lg transition-all flex items-center justify-center ${
          panelOpen
            ? "bg-indigo-600 text-white rotate-45"
            : "bg-indigo-600 text-white hover:bg-indigo-500"
        }`}
        title="Smart Import"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {panelOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          )}
        </svg>
        {/* Badge for pending events */}
        {pendingEvents.length > 0 && !panelOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
            {pendingEvents.length > 9 ? "9+" : pendingEvents.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {panelOpen && (
        <div className="fixed bottom-[140px] right-4 z-40 w-[420px] max-h-[calc(100vh-160px)] bg-[#16161f] border border-[#2a2a3c] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#2a2a3c] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 text-sm font-semibold">Smart Import</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-medium">
                EXPERIMENTAL
              </span>
            </div>
            <button
              onClick={() => {
                setActive(false);
                setPanelOpen(false);
              }}
              className="text-gray-500 hover:text-red-400 text-xs transition-colors"
              title="Disable Smart Import"
            >
              Disable
            </button>
          </div>

          {/* Tab bar */}
          <div className="px-4 pt-3 flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-indigo-600 text-white"
                    : "bg-[#1e1e30] text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "quick" && (
            <QuickImportTab onEventsParsed={handleNewEvents} />
          )}
          {activeTab === "email" && (
            <EmailSourcesTab onNewEvents={handleNewEvents} />
          )}
          {activeTab === "settings" && <ImportSettingsTab />}

          {/* Approval Queue (always visible when there are pending events) */}
          <ApprovalQueue
            events={pendingEvents}
            onEventsChange={setPendingEvents}
            onApproved={handleApproved}
          />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-[140px] right-[440px] z-50 bg-emerald-600 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
