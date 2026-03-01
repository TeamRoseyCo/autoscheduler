"use client";

import { useState, useEffect, useRef } from "react";
import type { CalendarEventData } from "@/components/week-calendar";
import { getPreferences } from "@/lib/actions/preferences";

interface SavedPlace {
  name: string;
  address: string;
}

interface TransportResult {
  [mode: string]: number | null;
}

interface TransportBufferModalProps {
  event: CalendarEventData;
  initialLocation?: string;
  initialTransportBefore?: number;
  initialTransportAfter?: number;
  initialTransportMode?: string;
  onClose: () => void;
  onSave: (data: {
    location: string;
    transportBefore: number;
    transportAfter: number;
    transportMode: string;
  }) => void;
}

const MODES = [
  { id: "driving", label: "Driving", icon: "🚗" },
  { id: "transit", label: "Transit", icon: "🚌" },
  { id: "walking", label: "Walking", icon: "🚶" },
  { id: "cycling", label: "Cycling", icon: "🚴" },
] as const;

function formatLeaveTime(startTimeISO: string, minutesBefore: number): string {
  const start = new Date(startTimeISO);
  const leaveTime = new Date(start.getTime() - minutesBefore * 60 * 1000);
  return leaveTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatArriveTime(startTimeISO: string): string {
  return new Date(startTimeISO).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TransportBufferModal({
  event,
  initialLocation = "",
  initialTransportBefore = 0,
  initialTransportAfter = 0,
  initialTransportMode = "driving",
  onClose,
  onSave,
}: TransportBufferModalProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(initialLocation);
  const [selectedMode, setSelectedMode] = useState(initialTransportMode || "driving");
  const [transportBefore, setTransportBefore] = useState(initialTransportBefore);
  const [transportAfter, setTransportAfter] = useState(initialTransportAfter);
  const [results, setResults] = useState<TransportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [fromSuggestions, setFromSuggestions] = useState(false);
  const [toSuggestions, setToSuggestions] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Load saved places
  useEffect(() => {
    getPreferences().then((prefs) => {
      if (prefs?.savedPlaces) {
        try {
          setSavedPlaces(JSON.parse(prefs.savedPlaces));
        } catch {
          // ignore malformed JSON
        }
      }
    });
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleGetTravelTime = async () => {
    if (!from.trim() || !to.trim()) {
      setError("Please enter both From and To addresses");
      return;
    }
    setLoading(true);
    setError("");
    setResults(null);

    try {
      const res = await fetch("/api/transport/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: from.trim(),
          to: to.trim(),
          departureTime: event.startTime,
          modes: [selectedMode],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "no_key") {
          setError("Google Maps API key not configured. Add it in Settings → Maps & Transport.");
        } else {
          setError(data.error || "Failed to get travel time");
        }
        return;
      }

      setResults(data);

      const minutes = data[selectedMode];
      if (typeof minutes === "number") {
        setTransportBefore(minutes);
        setTransportAfter(minutes);
      } else {
        setError("Route not found for selected mode");
      }
    } catch {
      setError("Failed to connect to travel time service");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    onSave({
      location: to.trim(),
      transportBefore,
      transportAfter,
      transportMode: selectedMode,
    });
  };

  const filteredFromPlaces = savedPlaces.filter(
    (p) =>
      p.name.toLowerCase().includes(from.toLowerCase()) ||
      p.address.toLowerCase().includes(from.toLowerCase())
  );

  const filteredToPlaces = savedPlaces.filter(
    (p) =>
      p.name.toLowerCase().includes(to.toLowerCase()) ||
      p.address.toLowerCase().includes(to.toLowerCase())
  );

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div
        className="relative w-full max-w-md bg-[#1e1e30] border border-[#2a2a3c] rounded-xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🗺️</span>
            <h3 className="text-sm font-semibold text-gray-200">Transport Buffer</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-[#2a2a3c]"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* From / To */}
          <div className="space-y-2">
            {/* From */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="text"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                onFocus={() => setFromSuggestions(true)}
                onBlur={() => setTimeout(() => setFromSuggestions(false), 150)}
                placeholder="Your starting location"
                className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
              />
              {fromSuggestions && filteredFromPlaces.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e30] border border-[#2a2a3c] rounded-lg shadow-xl z-10 max-h-32 overflow-y-auto">
                  {filteredFromPlaces.map((place) => (
                    <button
                      key={place.name}
                      onMouseDown={() => {
                        setFrom(place.address);
                        setFromSuggestions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] text-left"
                    >
                      <span className="text-xs text-gray-500">📍</span>
                      <div>
                        <div className="text-xs font-medium text-gray-200">{place.name}</div>
                        <div className="text-xs text-gray-500 truncate">{place.address}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* To */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1">To (event location)</label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                onFocus={() => setToSuggestions(true)}
                onBlur={() => setTimeout(() => setToSuggestions(false), 150)}
                placeholder="Destination address"
                className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
              />
              {toSuggestions && filteredToPlaces.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e30] border border-[#2a2a3c] rounded-lg shadow-xl z-10 max-h-32 overflow-y-auto">
                  {filteredToPlaces.map((place) => (
                    <button
                      key={place.name}
                      onMouseDown={() => {
                        setTo(place.address);
                        setToSuggestions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3c] text-left"
                    >
                      <span className="text-xs text-gray-500">📍</span>
                      <div>
                        <div className="text-xs font-medium text-gray-200">{place.name}</div>
                        <div className="text-xs text-gray-500 truncate">{place.address}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mode selector */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Transport Mode</label>
            <div className="flex gap-2">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedMode(mode.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all ${
                    selectedMode === mode.id
                      ? "bg-indigo-600 text-white"
                      : "bg-[#2a2a3c] text-gray-400 hover:text-gray-200 hover:bg-[#3a3a4c]"
                  }`}
                >
                  <span>{mode.icon}</span>
                  <span className="hidden sm:inline">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Get travel time button */}
          <button
            type="button"
            onClick={handleGetTravelTime}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#2a2a3c] hover:bg-[#3a3a4c] border border-[#3a3a4c] px-4 py-2 text-sm text-gray-300 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-500 border-t-gray-200" />
                Getting travel time...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-indigo-400">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Get travel time
              </>
            )}
          </button>

          {/* Results */}
          {results && (
            <div className="rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-2">
              <div className="flex flex-wrap gap-3">
                {MODES.filter((m) => results[m.id] != null).map((mode) => (
                  <span key={mode.id} className="text-xs text-gray-400">
                    {mode.icon} <span className="text-gray-200 font-medium">{results[mode.id]} min</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Before / After inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Before event (min)</label>
              <input
                type="number"
                min={0}
                max={240}
                value={transportBefore}
                onChange={(e) => setTransportBefore(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">After event (min)</label>
              <input
                type="number"
                min={0}
                max={240}
                value={transportAfter}
                onChange={(e) => setTransportAfter(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-[#12121c] border border-[#2a2a3c] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Leave by info */}
          {transportBefore > 0 && (
            <p className="text-xs text-indigo-300/80 flex items-center gap-1.5">
              <span>
                {MODES.find((m) => m.id === selectedMode)?.icon}
              </span>
              Leave by{" "}
              <span className="font-medium">
                {formatLeaveTime(event.startTime, transportBefore)}
              </span>{" "}
              to arrive by{" "}
              <span className="font-medium">{formatArriveTime(event.startTime)}</span>
            </p>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
