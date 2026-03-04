export interface PresetMetric {
  name: string;
  unit: string;
  icon: string;
  category: string;
  aggregation: "sum" | "max" | "avg" | "last";
}

export const PRESET_METRICS: PresetMetric[] = [
  // content
  { name: "Videos Produced", unit: "videos", icon: "🎬", category: "content", aggregation: "sum" },
  { name: "Uploads", unit: "uploads", icon: "📤", category: "content", aggregation: "sum" },
  { name: "Video Length", unit: "min", icon: "⏱️", category: "content", aggregation: "sum" },
  { name: "Thumbnails Made", unit: "thumbnails", icon: "🖼️", category: "content", aggregation: "sum" },
  { name: "Scripts Written", unit: "scripts", icon: "📝", category: "content", aggregation: "sum" },
  { name: "Podcast Episodes", unit: "episodes", icon: "🎙️", category: "content", aggregation: "sum" },

  // sales
  { name: "Dials", unit: "calls", icon: "📞", category: "sales", aggregation: "sum" },
  { name: "Connects", unit: "connects", icon: "🤝", category: "sales", aggregation: "sum" },
  { name: "Appointments Set", unit: "appointments", icon: "📅", category: "sales", aggregation: "sum" },
  { name: "Demos Done", unit: "demos", icon: "💻", category: "sales", aggregation: "sum" },
  { name: "Proposals Sent", unit: "proposals", icon: "📋", category: "sales", aggregation: "sum" },
  { name: "Deals Closed", unit: "deals", icon: "🏆", category: "sales", aggregation: "sum" },
  { name: "Revenue", unit: "$", icon: "💰", category: "sales", aggregation: "sum" },

  // fitness-running
  { name: "Distance", unit: "km", icon: "🏃", category: "fitness-running", aggregation: "sum" },
  { name: "Run Duration", unit: "min", icon: "⏱️", category: "fitness-running", aggregation: "sum" },
  { name: "Pace", unit: "min/km", icon: "⚡", category: "fitness-running", aggregation: "avg" },
  { name: "Calories Burned", unit: "kcal", icon: "🔥", category: "fitness-running", aggregation: "sum" },

  // fitness-gym
  { name: "Max Weight", unit: "kg", icon: "🏋️", category: "fitness-gym", aggregation: "max" },
  { name: "Total Volume", unit: "kg", icon: "💪", category: "fitness-gym", aggregation: "sum" },
  { name: "Sets Completed", unit: "sets", icon: "🔢", category: "fitness-gym", aggregation: "sum" },
  { name: "Personal Record", unit: "kg", icon: "🏆", category: "fitness-gym", aggregation: "max" },
  { name: "Workouts Done", unit: "workouts", icon: "🏋️", category: "fitness-gym", aggregation: "sum" },

  // finance
  { name: "Money Earned", unit: "$", icon: "💵", category: "finance", aggregation: "sum" },
  { name: "Invoices Sent", unit: "invoices", icon: "📄", category: "finance", aggregation: "sum" },
  { name: "Leads Generated", unit: "leads", icon: "🎯", category: "finance", aggregation: "sum" },
  { name: "Clients Acquired", unit: "clients", icon: "🤝", category: "finance", aggregation: "sum" },

  // writing
  { name: "Words Written", unit: "words", icon: "✍️", category: "writing", aggregation: "sum" },
  { name: "Articles Published", unit: "articles", icon: "📰", category: "writing", aggregation: "sum" },
  { name: "Pages Written", unit: "pages", icon: "📄", category: "writing", aggregation: "sum" },

  // reading
  { name: "Pages Read", unit: "pages", icon: "📖", category: "reading", aggregation: "sum" },
  { name: "Books Completed", unit: "books", icon: "📚", category: "reading", aggregation: "sum" },
  { name: "Chapters Read", unit: "chapters", icon: "🔖", category: "reading", aggregation: "sum" },

  // coding
  { name: "Commits", unit: "commits", icon: "💾", category: "coding", aggregation: "sum" },
  { name: "PRs Merged", unit: "PRs", icon: "🔀", category: "coding", aggregation: "sum" },
  { name: "Bugs Fixed", unit: "bugs", icon: "🐛", category: "coding", aggregation: "sum" },
  { name: "Features Shipped", unit: "features", icon: "🚀", category: "coding", aggregation: "sum" },
  { name: "Lines of Code", unit: "lines", icon: "💻", category: "coding", aggregation: "sum" },

  // study
  { name: "Hours Studied", unit: "hours", icon: "📚", category: "study", aggregation: "sum" },
  { name: "Flashcards Reviewed", unit: "cards", icon: "🃏", category: "study", aggregation: "sum" },
  { name: "Topics Covered", unit: "topics", icon: "🎯", category: "study", aggregation: "sum" },

  // social
  { name: "Posts Created", unit: "posts", icon: "📱", category: "social", aggregation: "sum" },
  { name: "Followers Gained", unit: "followers", icon: "👥", category: "social", aggregation: "sum" },
  { name: "Content Pieces", unit: "pieces", icon: "🎨", category: "social", aggregation: "sum" },

  // outreach
  { name: "Emails Sent", unit: "emails", icon: "📧", category: "outreach", aggregation: "sum" },
  { name: "Responses Received", unit: "responses", icon: "💬", category: "outreach", aggregation: "sum" },
  { name: "Follow-ups Done", unit: "follow-ups", icon: "🔁", category: "outreach", aggregation: "sum" },

  // love-family (Love & Family Life)
  { name: "Date Nights", unit: "dates", icon: "💑", category: "love-family", aggregation: "sum" },
  { name: "Quality Time Together", unit: "hours", icon: "❤️", category: "love-family", aggregation: "sum" },
  { name: "Love Letters Written", unit: "letters", icon: "💌", category: "love-family", aggregation: "sum" },
  { name: "Surprises Given", unit: "surprises", icon: "🎁", category: "love-family", aggregation: "sum" },
  { name: "Deep Conversations", unit: "conversations", icon: "💬", category: "love-family", aggregation: "sum" },
  { name: "Relationship Check-ins", unit: "check-ins", icon: "🫶", category: "love-family", aggregation: "sum" },
  { name: "Acts of Service", unit: "acts", icon: "🤲", category: "love-family", aggregation: "sum" },
  { name: "Marriage Goals Met", unit: "goals", icon: "💍", category: "love-family", aggregation: "sum" },
  { name: "Romantic Gestures", unit: "gestures", icon: "🌹", category: "love-family", aggregation: "sum" },
  { name: "Compliments Given", unit: "compliments", icon: "💕", category: "love-family", aggregation: "sum" },
  { name: "Family Dinners", unit: "dinners", icon: "🍽️", category: "love-family", aggregation: "sum" },
  { name: "Family Activities", unit: "activities", icon: "👨‍👩‍👧‍👦", category: "love-family", aggregation: "sum" },
  { name: "Kids Quality Time", unit: "hours", icon: "👶", category: "love-family", aggregation: "sum" },
  { name: "Family Outings", unit: "outings", icon: "🏞️", category: "love-family", aggregation: "sum" },
  { name: "Calls to Parents", unit: "calls", icon: "📱", category: "love-family", aggregation: "sum" },
  { name: "Family Game Nights", unit: "nights", icon: "🎲", category: "love-family", aggregation: "sum" },
  { name: "Prayers Together", unit: "prayers", icon: "🤲", category: "love-family", aggregation: "sum" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  content: "Content Creation",
  sales: "Sales",
  "fitness-running": "Fitness — Running",
  "fitness-gym": "Fitness — Gym",
  finance: "Finance",
  writing: "Writing",
  reading: "Reading",
  coding: "Coding",
  study: "Study",
  social: "Social Media",
  outreach: "Outreach",
  "love-family": "Love & Family Life",
  // Legacy keys for backward compat with existing DB entries
  relationships: "Love & Family Life",
  family: "Love & Family Life",
};
