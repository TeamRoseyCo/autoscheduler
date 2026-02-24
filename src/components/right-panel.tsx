"use client";

import { MiniCalendar } from "@/components/mini-calendar";

interface RightPanelProps {
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
  onClose?: () => void;
  showGoogleEvents?: boolean;
  onToggleGoogleEvents?: () => void;
  showLocalEvents?: boolean;
  onToggleLocalEvents?: () => void;
}

export function RightPanel({
  onDateSelect,
  selectedDate,
  onClose,
  showGoogleEvents = true,
  onToggleGoogleEvents,
  showLocalEvents = true,
  onToggleLocalEvents,
}: RightPanelProps) {
  return (
    <aside className="w-[280px] flex-shrink-0 bg-[#16161f] border-l border-[#2a2a3c] flex flex-col h-full overflow-y-auto select-none">
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
        <MiniCalendar onDateSelect={onDateSelect} selectedDate={selectedDate} />
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
