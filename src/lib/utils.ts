export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
}

export function getColorForEnergyType(energyType: string): string {
  switch (energyType) {
    case "deep":
      return "indigo";
    case "light":
      return "emerald";
    case "admin":
      return "amber";
    default:
      return "gray";
  }
}

export function getColorClasses(color: string): {
  bg: string;
  border: string;
  text: string;
} {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    indigo: {
      bg: "bg-indigo-500/15",
      border: "border-indigo-500",
      text: "text-indigo-300",
    },
    emerald: {
      bg: "bg-emerald-500/15",
      border: "border-emerald-500",
      text: "text-emerald-300",
    },
    amber: {
      bg: "bg-amber-500/15",
      border: "border-amber-500",
      text: "text-amber-300",
    },
    gray: {
      bg: "bg-gray-500/15",
      border: "border-gray-500",
      text: "text-gray-300",
    },
    rose: {
      bg: "bg-rose-500/15",
      border: "border-rose-500",
      text: "text-rose-300",
    },
    cyan: {
      bg: "bg-cyan-500/15",
      border: "border-cyan-500",
      text: "text-cyan-300",
    },
    violet: {
      bg: "bg-violet-500/15",
      border: "border-violet-500",
      text: "text-violet-300",
    },
    orange: {
      bg: "bg-orange-500/15",
      border: "border-orange-500",
      text: "text-orange-300",
    },
  };
  return colors[color] || colors.gray;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDateForInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function toLocaleDateString(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function toLocaleTimeString(date: Date, timezone: string): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
