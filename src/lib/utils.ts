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
      bg: "bg-indigo-100",
      border: "border-indigo-400",
      text: "text-indigo-800",
    },
    emerald: {
      bg: "bg-emerald-100",
      border: "border-emerald-400",
      text: "text-emerald-800",
    },
    amber: {
      bg: "bg-amber-100",
      border: "border-amber-400",
      text: "text-amber-800",
    },
    gray: {
      bg: "bg-gray-100",
      border: "border-gray-400",
      text: "text-gray-800",
    },
    rose: {
      bg: "bg-rose-100",
      border: "border-rose-400",
      text: "text-rose-800",
    },
    cyan: {
      bg: "bg-cyan-100",
      border: "border-cyan-400",
      text: "text-cyan-800",
    },
    violet: {
      bg: "bg-violet-100",
      border: "border-violet-400",
      text: "text-violet-800",
    },
    orange: {
      bg: "bg-orange-100",
      border: "border-orange-400",
      text: "text-orange-800",
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
