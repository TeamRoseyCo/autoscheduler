export interface Categorization {
  energyType: "deep" | "light" | "admin";
  emoji: string;
}

const ADMIN_KEYWORDS = [
  "meeting", "call", "email", "review", "standup", "sync",
  "lunch", "1:1", "interview", "hr", "retro", "scrum",
  "weekly", "daily", "check-in", "checkin", "onboarding",
  "invoice", "budget", "expense", "payroll", "admin",
  "cold call", "sales call", "followup", "follow up", "follow-up",
];

const DEEP_KEYWORDS = [
  "code", "write", "design", "build", "develop", "research",
  "analyze", "implement", "debug", "architect", "plan",
  "refactor", "test", "deploy", "migrate", "prototype",
  "experiment", "study", "learn", "document",
  "edit", "editing", "video", "film", "record", "render",
  "produce", "animate", "compose", "mix", "master",
  "draw", "illustrate", "paint", "model", "sculpt",
  "essay", "thesis", "report", "proposal",
];

const LIGHT_KEYWORDS = [
  "upload", "post", "publish", "share", "send", "organize",
  "clean", "sort", "file", "backup", "update", "reply",
  "schedule", "book", "order", "pick up", "errand",
  "workout", "exercise", "gym", "run", "walk", "stretch",
  "read", "browse", "watch", "listen",
  "pray", "prayer", "meditate", "journal",
  "shop", "grocery", "cook", "meal prep",
  "laundry", "chore",
];

const EMOJI_MAP: Record<string, string> = {
  // Admin / communication
  meeting: "\u{1F4DE}",
  call: "\u{1F4DE}",
  standup: "\u{1F4DE}",
  sync: "\u{1F4DE}",
  "1:1": "\u{1F4DE}",
  daily: "\u{1F4DE}",
  weekly: "\u{1F4DE}",
  retro: "\u{1F4DE}",
  scrum: "\u{1F4DE}",
  "cold call": "\u{1F4DE}",
  "sales call": "\u{1F4DE}",
  invoice: "\u{1F4B0}",
  budget: "\u{1F4B0}",
  expense: "\u{1F4B0}",
  payroll: "\u{1F4B0}",
  admin: "\u{1F4CB}",

  // Deep work — coding
  code: "\u{1F4BB}",
  develop: "\u{1F4BB}",
  debug: "\u{1F4BB}",
  implement: "\u{1F4BB}",
  build: "\u{1F4BB}",
  refactor: "\u{1F4BB}",
  deploy: "\u{1F680}",
  test: "\u{1F4BB}",

  // Deep work — writing
  write: "\u{270D}\uFE0F",
  document: "\u{270D}\uFE0F",
  essay: "\u{270D}\uFE0F",
  thesis: "\u{270D}\uFE0F",
  proposal: "\u{270D}\uFE0F",

  // Deep work — video/media
  video: "\u{1F3AC}",
  film: "\u{1F3AC}",
  record: "\u{1F3AC}",
  edit: "\u{1F3AC}",
  editing: "\u{1F3AC}",
  produce: "\u{1F3AC}",
  render: "\u{1F3AC}",
  animate: "\u{1F3AC}",

  // Deep work — audio
  compose: "\u{1F3B5}",
  mix: "\u{1F3B5}",
  master: "\u{1F3B5}",

  // Deep work — design/art
  design: "\u{1F3A8}",
  prototype: "\u{1F3A8}",
  draw: "\u{1F3A8}",
  illustrate: "\u{1F3A8}",
  paint: "\u{1F3A8}",
  model: "\u{1F3A8}",
  sculpt: "\u{1F3A8}",

  // Deep work — research
  research: "\u{1F50D}",
  analyze: "\u{1F50D}",
  study: "\u{1F50D}",
  learn: "\u{1F50D}",
  experiment: "\u{1F9EA}",
  report: "\u{1F4CA}",

  // Admin misc
  email: "\u{1F4E7}",
  review: "\u{1F440}",
  plan: "\u{1F4CB}",
  interview: "\u{1F4CB}",
  hr: "\u{1F4CB}",
  onboarding: "\u{1F4CB}",
  lunch: "\u{1F37D}\uFE0F",
  followup: "\u{1F4E8}",
  "follow up": "\u{1F4E8}",
  "follow-up": "\u{1F4E8}",

  // Light — digital
  upload: "\u{2B06}\uFE0F",
  post: "\u{1F4F1}",
  publish: "\u{1F4F1}",
  share: "\u{1F4F1}",
  send: "\u{1F4E8}",

  // Light — organization
  organize: "\u{1F4C1}",
  clean: "\u{1F9F9}",
  sort: "\u{1F4C1}",
  file: "\u{1F4C1}",
  backup: "\u{1F4BE}",
  update: "\u{1F504}",

  // Light — errands
  schedule: "\u{1F4C5}",
  book: "\u{1F4D6}",
  order: "\u{1F4E6}",
  "pick up": "\u{1F4E6}",
  errand: "\u{1F3C3}",
  shop: "\u{1F6D2}",
  grocery: "\u{1F6D2}",

  // Light — health/wellness
  workout: "\u{1F4AA}",
  exercise: "\u{1F4AA}",
  gym: "\u{1F4AA}",
  run: "\u{1F3C3}",
  walk: "\u{1F6B6}",
  stretch: "\u{1F9D8}",
  meditate: "\u{1F9D8}",
  pray: "\u{1F64F}",
  prayer: "\u{1F64F}",
  journal: "\u{1F4D3}",

  // Light — consumption
  read: "\u{1F4D6}",
  browse: "\u{1F310}",
  watch: "\u{1F4FA}",
  listen: "\u{1F3A7}",

  // Light — home
  cook: "\u{1F373}",
  "meal prep": "\u{1F373}",
  laundry: "\u{1F9FA}",
  chore: "\u{1F9F9}",

  // Deep misc
  migrate: "\u{1F680}",

  // Specific items people schedule
  cigar: "\u{1FAA8}",
  pipe: "\u{1FAA8}",
  smoke: "\u{1FAA8}",
  coffee: "\u{2615}",
  tea: "\u{2615}",
  nap: "\u{1F634}",
  sleep: "\u{1F634}",
  break: "\u{2615}",
  dentist: "\u{1FA7A}",
  doctor: "\u{1FA7A}",
  appointment: "\u{1F4C5}",
  class: "\u{1F393}",
  lecture: "\u{1F393}",
  exam: "\u{1F4DD}",
  homework: "\u{1F4DD}",
  love: "\u{2764}\uFE0F",
  letter: "\u{1F48C}",
  gift: "\u{1F381}",
  party: "\u{1F389}",
  birthday: "\u{1F382}",
  travel: "\u{2708}\uFE0F",
  flight: "\u{2708}\uFE0F",
  drive: "\u{1F697}",
  commute: "\u{1F697}",
  muslim: "\u{1F54C}",
  mosque: "\u{1F54C}",
  church: "\u{26EA}",
  bible: "\u{1F4D6}",
  quran: "\u{1F4D6}",
};

const DEFAULT_EMOJI = "\u{1F4CC}";

export function categorizeTask(title: string): Categorization {
  const lower = title.toLowerCase();

  // Strip any leading emoji before matching
  const stripped = lower.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\uFE0F?\s*/u, "");

  // Check admin keywords first (meetings are very specific)
  for (const kw of ADMIN_KEYWORDS) {
    if (stripped.includes(kw)) {
      const emoji = EMOJI_MAP[kw] || DEFAULT_EMOJI;
      return { energyType: "admin", emoji };
    }
  }

  // Check deep work keywords
  for (const kw of DEEP_KEYWORDS) {
    if (stripped.includes(kw)) {
      const emoji = EMOJI_MAP[kw] || DEFAULT_EMOJI;
      return { energyType: "deep", emoji };
    }
  }

  // Check light keywords
  for (const kw of LIGHT_KEYWORDS) {
    if (stripped.includes(kw)) {
      const emoji = EMOJI_MAP[kw] || DEFAULT_EMOJI;
      return { energyType: "light", emoji };
    }
  }

  // Last resort: check individual words against the emoji map for best-effort emoji
  const words = stripped.split(/\s+/);
  for (const word of words) {
    if (EMOJI_MAP[word]) {
      return { energyType: "light", emoji: EMOJI_MAP[word] };
    }
  }

  // Default to light
  return { energyType: "light", emoji: DEFAULT_EMOJI };
}
