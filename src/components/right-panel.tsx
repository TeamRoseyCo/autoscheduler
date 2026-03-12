"use client";

import { MiniCalendar } from "@/components/mini-calendar";
import { getMoonPhase, toHijri, formatHijriMonthYear } from "@/lib/hijri";
import { MiniLantern } from "@/components/ramadan-ornaments";

interface RightPanelProps {
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
  onClose?: () => void;
  showGoogleEvents?: boolean;
  onToggleGoogleEvents?: () => void;
  showLocalEvents?: boolean;
  onToggleLocalEvents?: () => void;
  showHijri?: boolean;
  onToggleHijri?: () => void;
  ramadanMode?: boolean;
}

/** Compact moon phase SVG */
function MoonPhaseBadge() {
  const moon = getMoonPhase(new Date());
  const size = 64;
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const p = moon.phase;

  let d: string;
  if (p < 0.5) {
    const terminatorX = r * Math.cos(p * 2 * Math.PI);
    d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${Math.abs(terminatorX)} ${r} 0 0 ${p < 0.25 ? 1 : 0} ${cx} ${cy - r} Z`;
  } else {
    const terminatorX = r * Math.cos(p * 2 * Math.PI);
    d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${Math.abs(terminatorX)} ${r} 0 0 ${p < 0.75 ? 0 : 1} ${cx} ${cy - r} Z`;
  }

  const hijriToday = formatHijriMonthYear(new Date());

  return (
    <div className="flex flex-col items-center gap-1.5 py-2">
      <div
        className="rounded-full bg-[#0a0a14] border border-[#2a2a3c] flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="#1a1a2a" />
          <circle cx={cx - r * 0.3} cy={cy - r * 0.2} r={r * 0.1} fill="#222235" opacity="0.4" />
          <circle cx={cx + r * 0.15} cy={cy + r * 0.3} r={r * 0.07} fill="#222235" opacity="0.3" />
          <path d={d} fill="url(#moonGradRight)" />
          <defs>
            <radialGradient id="moonGradRight" cx="40%" cy="40%">
              <stop offset="0%" stopColor="#f5f5dc" />
              <stop offset="100%" stopColor="#d4d4aa" />
            </radialGradient>
          </defs>
        </svg>
      </div>
      <p className="text-[10px] font-medium text-gray-400">{moon.name}</p>
      <p className="text-[9px] text-gray-600">{Math.round(moon.illumination * 100)}% illuminated</p>
      {hijriToday && <p className="text-[9px] text-amber-400/50">{hijriToday}</p>}
    </div>
  );
}

export function RightPanel({
  onDateSelect,
  selectedDate,
  onClose,
  showGoogleEvents = true,
  onToggleGoogleEvents,
  showLocalEvents = true,
  onToggleLocalEvents,
  showHijri = false,
  onToggleHijri,
  ramadanMode = false,
}: RightPanelProps) {
  return (
    <aside className={`w-[280px] flex-shrink-0 bg-[#16161f] border-l flex flex-col h-full overflow-y-auto select-none relative ${ramadanMode ? "border-amber-500/20" : "border-[#2a2a3c]"}`}>
      {ramadanMode && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none z-20" />
          <div className="absolute top-0 right-8 w-4 opacity-40 animate-pulse pointer-events-none z-20" style={{ animationDuration: "4s" }}>
            <MiniLantern className="w-full h-auto" />
          </div>
        </>
      )}
      {/* Close Button */}
      {onClose && (
        <div className="flex items-center justify-end px-3 pt-3 pb-0">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-[#2a2a3c]"
            title="Close panel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Mini Calendar */}
      <div className="px-4 pt-2 pb-3 border-b border-[#2a2a3c]">
        <MiniCalendar onDateSelect={onDateSelect} selectedDate={selectedDate} showHijri={showHijri} showLaylatulQadr={ramadanMode} />
      </div>

      {/* Moon Phase */}
      <div className="px-4 py-2 border-b border-[#2a2a3c]">
        <MoonPhaseBadge />
      </div>

      {/* Calendars Section */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200">Calendars</h3>
        </div>

        {/* Calendar Groups */}
        <div className="space-y-1">
          <CalendarGroup title="My calendars" count={1} defaultOpen>
            <CalendarCheckbox
              color="bg-blue-500"
              label="My Calendar"
              checked={showLocalEvents}
              onChange={onToggleLocalEvents}
            />
          </CalendarGroup>

          <CalendarGroup title="Accounts" count={1} defaultOpen>
            <CalendarCheckbox
              color="bg-emerald-500"
              label="Google Calendar"
              checked={showGoogleEvents}
              onChange={onToggleGoogleEvents}
            />
          </CalendarGroup>

          <CalendarGroup title="Display" count={1} defaultOpen>
            <CalendarCheckbox
              color="bg-amber-500"
              label="Hijri Dates"
              checked={showHijri}
              onChange={onToggleHijri}
            />
          </CalendarGroup>
        </div>
      </div>
    </aside>
  );
}

function CalendarGroup({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex items-center gap-1.5 px-1 py-1.5 rounded-md text-sm text-gray-400 hover:text-gray-300 cursor-pointer list-none transition-colors">
        <svg
          className="w-3 h-3 transition-transform group-open:rotate-90 flex-shrink-0"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{title}</span>
        <span className="text-gray-600 text-xs">({count})</span>
      </summary>
      {children && <div className="ml-4 mt-1 space-y-0.5">{children}</div>}
    </details>
  );
}

function CalendarCheckbox({
  color,
  label,
  checked,
  onChange,
}: {
  color: string;
  label: string;
  checked?: boolean;
  onChange?: () => void;
}) {
  return (
    <label
      className="flex items-center gap-2 px-1 py-1 rounded-md text-sm text-gray-400 hover:text-gray-300 cursor-pointer transition-colors"
      onClick={(e) => {
        e.preventDefault();
        onChange?.();
      }}
    >
      <div
        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors ${
          checked
            ? `${color} border-transparent`
            : "border-gray-600 bg-transparent"
        }`}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-xs truncate">{label}</span>
    </label>
  );
}
