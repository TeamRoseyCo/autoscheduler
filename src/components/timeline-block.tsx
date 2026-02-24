import { getColorClasses, formatDuration } from "@/lib/utils";
import type { ScheduledBlock } from "@/generated/prisma/client";

export function TimelineBlock({
  block,
  workStartHour,
}: {
  block: ScheduledBlock;
  workStartHour: number;
}) {
  const startTime = new Date(block.startTime);
  const endTime = new Date(block.endTime);

  const startHour = startTime.getHours() + startTime.getMinutes() / 60;
  const endHour = endTime.getHours() + endTime.getMinutes() / 60;
  const durationMinutes = Math.round((endHour - startHour) * 60);

  // Position: each hour = 80px
  const HOUR_HEIGHT = 80;
  const top = (startHour - workStartHour) * HOUR_HEIGHT;
  const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 24);

  const colors = getColorClasses(block.color);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return (
    <div
      className={`absolute left-16 right-2 rounded-md border-l-4 ${colors.border} ${colors.bg} px-3 py-1.5 overflow-hidden cursor-default transition-shadow hover:shadow-md`}
      style={{ top: `${top}px`, height: `${height}px` }}
      title={`${block.title} (${formatTime(startTime)} - ${formatTime(endTime)})`}
    >
      <div className={`text-xs font-medium ${colors.text} truncate`}>
        {block.title}
      </div>
      {height >= 40 && (
        <div className="text-xs text-gray-500 mt-0.5">
          {formatTime(startTime)} - {formatTime(endTime)} &middot;{" "}
          {formatDuration(durationMinutes)}
        </div>
      )}
    </div>
  );
}
