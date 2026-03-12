export interface HijriDate {
  day: number;
  month: number;
  monthName: string;
  year: number;
}

/** Get the user's hijri day offset (e.g. -1 for Europe moon sighting) */
export function getHijriOffset(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem("hijri-offset") || "0", 10) || 0;
}

const HIJRI_MONTHS: Record<string, number> = {
  muharram: 1,
  safar: 2,
  "rabi' i": 3, "rabi' al-awwal": 3, "rabiʻ i": 3,
  "rabi' ii": 4, "rabi' al-thani": 4, "rabiʻ ii": 4,
  "jumada i": 5, "jumada al-awwal": 5, "jumādā al-ūlā": 5,
  "jumada ii": 6, "jumada al-thani": 6, "jumādā al-ākhirah": 6,
  rajab: 7,
  "sha'ban": 8, shaʻban: 8, shaban: 8,
  ramadan: 9, "ramaḍān": 9,
  shawwal: 10, "shawwāl": 10,
  "dhu al-qi'dah": 11, "dhu al-qidah": 11, "dhū al-qaʿdah": 11,
  "dhu al-hijjah": 12, "dhū al-ḥijjah": 12,
};

const HIJRI_MONTH_NAMES = [
  "", "Muharram", "Safar", "Rabi' I", "Rabi' II",
  "Jumada I", "Jumada II", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhul Qi'dah", "Dhul Hijjah",
];

function parseHijriMonth(name: string): number {
  const lower = name.toLowerCase().normalize("NFKD");
  if (HIJRI_MONTHS[lower]) return HIJRI_MONTHS[lower];
  for (const [key, val] of Object.entries(HIJRI_MONTHS)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  // Fallback: try matching partial
  if (lower.includes("muharram")) return 1;
  if (lower.includes("safar")) return 2;
  if (lower.includes("rabi") && (lower.includes("i") && !lower.includes("ii"))) return 3;
  if (lower.includes("rabi") && lower.includes("ii")) return 4;
  if (lower.includes("jumada") && !lower.includes("ii")) return 5;
  if (lower.includes("jumada") && lower.includes("ii")) return 6;
  if (lower.includes("rajab")) return 7;
  if (lower.includes("sha") && lower.includes("ban")) return 8;
  if (lower.includes("ramad") || lower.includes("ramaḍ")) return 9;
  if (lower.includes("shaww")) return 10;
  if (lower.includes("qi") || lower.includes("qa")) return 11;
  if (lower.includes("hijj")) return 12;
  return 0;
}

export function toHijri(date: Date): HijriDate {
  try {
    // Apply user offset for regional moon sighting differences
    const offset = getHijriOffset();
    const adjusted = offset !== 0 ? new Date(date.getTime() + offset * 86400000) : date;
    const formatter = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const parts = formatter.formatToParts(adjusted);
    const day = parseInt(parts.find((p) => p.type === "day")?.value || "0");
    const monthStr = parts.find((p) => p.type === "month")?.value || "";
    const yearStr = parts.find((p) => p.type === "year")?.value || "0";
    const year = parseInt(yearStr.replace(/[^\d]/g, ""));
    const month = parseHijriMonth(monthStr);

    return {
      day,
      month,
      monthName: HIJRI_MONTH_NAMES[month] || monthStr,
      year,
    };
  } catch {
    return { day: 0, month: 0, monthName: "", year: 0 };
  }
}

export function isRamadan(date: Date): boolean {
  return toHijri(date).month === 9;
}

/**
 * Returns true if this date's evening is a potential Laylatul Qadr night.
 * In Islam, the night precedes the day — the night of the 21st starts on the
 * evening of Ramadan 20th (Gregorian). So we check if the NEXT Islamic day
 * is one of the odd nights (21, 23, 25, 27, 29).
 */
export function isLaylatulQadr(date: Date): boolean {
  // Check tomorrow's Hijri date since the night belongs to the next Islamic day
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const h = toHijri(tomorrow);
  if (h.month !== 9) return false;
  return [21, 23, 25, 27, 29].includes(h.day);
}

export function getRamadanDay(date: Date): number | null {
  const h = toHijri(date);
  return h.month === 9 ? h.day : null;
}

export function formatHijriShort(date: Date): string {
  const h = toHijri(date);
  if (!h.month) return "";
  return `${h.day} ${h.monthName.substring(0, 3)}`;
}

export function formatHijriMonthYear(date: Date): string {
  const h = toHijri(date);
  if (!h.month) return "";
  return `${h.monthName} ${h.year} AH`;
}

export interface MoonPhaseInfo {
  /** 0-1 normalized phase (0 = new moon, 0.5 = full moon) */
  phase: number;
  name: string;
  illumination: number;
}

export function getMoonPhase(date: Date): MoonPhaseInfo {
  const SYNODIC_PERIOD = 29.53058770576;
  const KNOWN_NEW_MOON = new Date(2000, 0, 6, 18, 14); // Jan 6, 2000 18:14 UTC

  const daysSinceNew = (date.getTime() - KNOWN_NEW_MOON.getTime()) / (1000 * 60 * 60 * 24);
  const phase = ((daysSinceNew % SYNODIC_PERIOD) + SYNODIC_PERIOD) % SYNODIC_PERIOD;
  const normalizedPhase = phase / SYNODIC_PERIOD;
  const illumination = (1 - Math.cos(normalizedPhase * 2 * Math.PI)) / 2;

  let name: string;
  if (normalizedPhase < 0.0625) name = "New Moon";
  else if (normalizedPhase < 0.1875) name = "Waxing Crescent";
  else if (normalizedPhase < 0.3125) name = "First Quarter";
  else if (normalizedPhase < 0.4375) name = "Waxing Gibbous";
  else if (normalizedPhase < 0.5625) name = "Full Moon";
  else if (normalizedPhase < 0.6875) name = "Waning Gibbous";
  else if (normalizedPhase < 0.8125) name = "Last Quarter";
  else if (normalizedPhase < 0.9375) name = "Waning Crescent";
  else name = "New Moon";

  return { phase: normalizedPhase, name, illumination };
}
