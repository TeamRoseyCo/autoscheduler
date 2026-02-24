import { TimelineBlock } from "@/components/timeline-block";
import type { ScheduledBlock } from "@/generated/prisma/client";
import { parseTime } from "@/lib/utils";

export function Timeline({
  blocks,
  workStartTime,
  workEndTime,
}: {
  blocks: ScheduledBlock[];
  workStartTime: string;
  workEndTime: string;
}) {
  const startHour = parseTime(workStartTime).hours;
  const endHour = parseTime(workEndTime).hours;
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i
  );

  const HOUR_HEIGHT = 80;
  const totalHeight = hours.length * HOUR_HEIGHT;

  const formatHour = (h: number) => {
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12} ${period}`;
  };

  return (
    <div className="rounded-lg bg-white shadow-sm border border-gray-200 overflow-hidden">
      <div className="relative" style={{ height: `${totalHeight}px` }}>
        {/* Hour grid lines */}
        {hours.map((hour, i) => (
          <div
            key={hour}
            className="absolute left-0 right-0 border-t border-gray-100"
            style={{ top: `${i * HOUR_HEIGHT}px` }}
          >
            <span className="absolute left-2 -top-2.5 text-xs text-gray-400 font-medium bg-white px-1">
              {formatHour(hour)}
            </span>
          </div>
        ))}

        {/* Current time indicator */}
        <CurrentTimeIndicator
          startHour={startHour}
          endHour={endHour}
          hourHeight={HOUR_HEIGHT}
        />

        {/* Scheduled blocks */}
        {blocks.map((block) => (
          <TimelineBlock
            key={block.id}
            block={block}
            workStartHour={startHour}
          />
        ))}

        {/* Empty state */}
        {blocks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-400">
              No scheduled blocks yet. Click &ldquo;Schedule My Day&rdquo; to
              get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CurrentTimeIndicator({
  startHour,
  endHour,
  hourHeight,
}: {
  startHour: number;
  endHour: number;
  hourHeight: number;
}) {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  if (currentHour < startHour || currentHour > endHour) return null;

  const top = (currentHour - startHour) * hourHeight;

  return (
    <div
      className="absolute left-14 right-0 z-10 flex items-center"
      style={{ top: `${top}px` }}
    >
      <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
      <div className="h-px flex-1 bg-red-500" />
    </div>
  );
}
