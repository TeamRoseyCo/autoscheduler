"use server";

import { auth } from "@/lib/auth";
import { getOpenAIClient } from "@/lib/openai";
import { categorizeTask } from "@/lib/categorize";
import { z } from "zod/v4";
import type { FollowUpQuestion, GeneratedProject, GeneratedTask, ProjectColor } from "@/types";

const aiResponseSchema = z.object({
  name: z.string(),
  description: z.string(),
  color: z.enum(["indigo", "emerald", "amber", "rose", "cyan", "violet", "orange"]),
  tasks: z.array(
    z.object({
      title: z.string(),
      durationMinutes: z.number().int().min(5).max(480),
      priority: z.enum(["high", "medium", "low"]),
      energyType: z.enum(["deep", "light", "admin"]),
    })
  ),
});

const ENERGY_TO_COLOR: Record<string, ProjectColor> = {
  deep: "indigo",
  light: "emerald",
  admin: "amber",
};

// ---- Smart local project generator ----

// Broad item types with display labels
const ITEM_TYPES: Record<string, string> = {
  video: "Video", videos: "Video",
  short: "Short", shorts: "Short",
  clip: "Clip", clips: "Clip",
  reel: "Reel", reels: "Reel",
  episode: "Episode", episodes: "Episode",
  scene: "Scene", scenes: "Scene",
  page: "Page", pages: "Page",
  chapter: "Chapter", chapters: "Chapter",
  module: "Module", modules: "Module",
  section: "Section", sections: "Section",
  lesson: "Lesson", lessons: "Lesson",
  lecture: "Lecture", lectures: "Lecture",
  slide: "Slide", slides: "Slide",
  post: "Post", posts: "Post",
  article: "Article", articles: "Article",
  blog: "Blog Post", blogs: "Blog Post",
  email: "Email", emails: "Email",
  tweet: "Tweet", tweets: "Tweet",
  task: "Task", tasks: "Task",
  item: "Item", items: "Item",
  feature: "Feature", features: "Feature",
  component: "Component", components: "Component",
  screen: "Screen", screens: "Screen",
  wireframe: "Wireframe", wireframes: "Wireframe",
  mockup: "Mockup", mockups: "Mockup",
  design: "Design", designs: "Design",
  drawing: "Drawing", drawings: "Drawing",
  illustration: "Illustration", illustrations: "Illustration",
  report: "Report", reports: "Report",
  deliverable: "Deliverable", deliverables: "Deliverable",
  assignment: "Assignment", assignments: "Assignment",
  problem: "Problem", problems: "Problem",
  question: "Question", questions: "Question",
  test: "Test", tests: "Test",
  quiz: "Quiz", quizzes: "Quiz",
  song: "Song", songs: "Song",
  track: "Track", tracks: "Track",
  beat: "Beat", beats: "Beat",
  photo: "Photo", photos: "Photo",
  image: "Image", images: "Image",
  graphic: "Graphic", graphics: "Graphic",
  logo: "Logo", logos: "Logo",
  banner: "Banner", banners: "Banner",
  thumbnail: "Thumbnail", thumbnails: "Thumbnail",
  ad: "Ad", ads: "Ad",
  campaign: "Campaign", campaigns: "Campaign",
  client: "Client", clients: "Client",
  order: "Order", orders: "Order",
  product: "Product", products: "Product",
  listing: "Listing", listings: "Listing",
  interview: "Interview", interviews: "Interview",
  call: "Call", calls: "Call",
  meeting: "Meeting", meetings: "Meeting",
  presentation: "Presentation", presentations: "Presentation",
  pitch: "Pitch", pitches: "Pitch",
  letter: "Letter", letters: "Letter",
  document: "Document", documents: "Document",
  form: "Form", forms: "Form",
  spreadsheet: "Spreadsheet", spreadsheets: "Spreadsheet",
  invoice: "Invoice", invoices: "Invoice",
  proposal: "Proposal", proposals: "Proposal",
  contract: "Contract", contracts: "Contract",
};

// Process verbs that help us understand what each task involves
const PROCESS_VERBS: Record<string, string> = {
  edit: "Edit", editing: "Edit",
  produce: "Produce", producing: "Produce",
  film: "Film", filming: "Film",
  record: "Record", recording: "Record",
  shoot: "Shoot", shooting: "Shoot",
  render: "Render", rendering: "Render",
  write: "Write", writing: "Write",
  design: "Design", designing: "Design",
  code: "Build", coding: "Build",
  build: "Build", building: "Build",
  develop: "Develop", developing: "Develop",
  create: "Create", creating: "Create",
  make: "Make", making: "Make",
  prepare: "Prepare", preparing: "Prepare",
  review: "Review", reviewing: "Review",
  revise: "Revise", revising: "Revise",
  upload: "Upload", uploading: "Upload",
  publish: "Publish", publishing: "Publish",
  draw: "Draw", paint: "Paint",
  illustrate: "Illustrate",
  animate: "Animate", animating: "Animate",
  mix: "Mix", mixing: "Mix",
  master: "Master", mastering: "Master",
  compose: "Compose", composing: "Compose",
  research: "Research", researching: "Research",
  plan: "Plan", planning: "Plan",
  outline: "Outline", outlining: "Outline",
  draft: "Draft", drafting: "Draft",
  proofread: "Proofread", proofreading: "Proofread",
  translate: "Translate", translating: "Translate",
  transcribe: "Transcribe", transcribing: "Transcribe",
  organize: "Organize", organizing: "Organize",
  schedule: "Schedule", scheduling: "Schedule",
  setup: "Set up", "set up": "Set up",
  configure: "Configure", install: "Install",
  test: "Test", testing: "Test",
  debug: "Debug", fix: "Fix",
  optimize: "Optimize", clean: "Clean up",
};

function extractCount(text: string): { count: number; itemLabel: string; matchEnd: number } | null {
  const lower = text.toLowerCase();

  // Pattern: "20 shorts", "5 videos", "10 blog posts"
  const itemTypeKeys = Object.keys(ITEM_TYPES).sort((a, b) => b.length - a.length);
  for (const key of itemTypeKeys) {
    // "N <itemType>" or "<itemType> N"
    const pattern1 = new RegExp(`(\\d+)\\s+${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    const pattern2 = new RegExp(`${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:=]?\\s*(\\d+)`, "i");
    const m1 = lower.match(pattern1);
    if (m1) {
      return { count: parseInt(m1[1]), itemLabel: ITEM_TYPES[key], matchEnd: m1.index! + m1[0].length };
    }
    const m2 = lower.match(pattern2);
    if (m2) {
      return { count: parseInt(m2[1]), itemLabel: ITEM_TYPES[key], matchEnd: m2.index! + m2[0].length };
    }
  }
  return null;
}

function extractDuration(text: string): number | null {
  const lower = text.toLowerCase();
  // "3 hour", "90 minutes", "1.5 hours", "2.5 hr", "45 min"
  const match = lower.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const unit = match[2];
  if (unit.startsWith("h")) return Math.round(num * 60);
  return Math.round(num);
}

function extractVerb(text: string): string | null {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  for (const w of words) {
    if (PROCESS_VERBS[w]) return PROCESS_VERBS[w];
  }
  return null;
}

function smartProjectName(prompt: string, verb: string | null, itemLabel: string | null, count: number | null): string {
  // Try to build a nice name from what we know
  if (verb && itemLabel && count) {
    return `${verb} ${count} ${itemLabel}${count > 1 ? "s" : ""}`;
  }
  if (verb && itemLabel) {
    return `${verb} ${itemLabel}s`;
  }
  // Fall back to cleaning up the first clause
  const first = prompt.split(/[.,!?\n]/)[0].trim();
  // Capitalize first letter
  const name = first.charAt(0).toUpperCase() + first.slice(1);
  return name.length > 50 ? name.slice(0, 47) + "..." : name;
}

function smartDescription(prompt: string, count: number | null, itemLabel: string | null, perItemMinutes: number | null): string {
  const parts: string[] = [];
  if (count && itemLabel) {
    parts.push(`${count} ${itemLabel.toLowerCase()}${count > 1 ? "s" : ""} to complete`);
  }
  if (perItemMinutes) {
    const hrs = Math.floor(perItemMinutes / 60);
    const mins = perItemMinutes % 60;
    const timeStr = hrs > 0
      ? mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
      : `${mins}m`;
    parts.push(`${timeStr} each`);
  }
  if (count && perItemMinutes) {
    const totalMins = count * perItemMinutes;
    const totalHrs = Math.floor(totalMins / 60);
    const remainMins = totalMins % 60;
    const totalStr = totalHrs > 0
      ? remainMins > 0 ? `${totalHrs}h ${remainMins}m` : `${totalHrs}h`
      : `${remainMins}m`;
    parts.push(`${totalStr} total`);
  }
  return parts.length > 0
    ? parts.join(". ") + "."
    : prompt.length > 120 ? prompt.slice(0, 117) + "..." : prompt;
}

/**
 * Smart local fallback that deeply parses the prompt to generate a real project.
 */
function generateProjectLocally(prompt: string): GeneratedProject {
  const lower = prompt.toLowerCase();

  // --- Extract structured data from the prompt ---
  const countResult = extractCount(prompt);
  const perItemMinutes = extractDuration(prompt);
  const verb = extractVerb(prompt);

  const itemCount = countResult?.count || null;
  const itemLabel = countResult?.itemLabel || null;
  const durationPerItem = perItemMinutes || 60; // default 1 hour

  const projectName = smartProjectName(prompt, verb, itemLabel, itemCount);
  const description = smartDescription(prompt, itemCount, itemLabel, perItemMinutes || null);

  const tasks: GeneratedTask[] = [];

  // --- Case 1: Repeated items detected (e.g. "20 shorts", "5 articles") ---
  if (itemCount && itemCount > 0 && itemLabel) {
    const actionVerb = verb || "Complete";
    const cat = categorizeTask(`${actionVerb} ${itemLabel}`);

    if (itemCount <= 25) {
      // Create individual tasks for each item
      for (let i = 1; i <= itemCount; i++) {
        const priority = i <= Math.ceil(itemCount * 0.3) ? "high"
          : i <= Math.ceil(itemCount * 0.7) ? "medium" : "low";

        tasks.push({
          title: `${cat.emoji} ${actionVerb} ${itemLabel} #${i}`,
          durationMinutes: Math.min(durationPerItem, 480),
          priority: priority as GeneratedTask["priority"],
          energyType: cat.energyType,
        });
      }
    } else {
      // Too many — create sensible batches (groups of 5-10)
      const batchSize = itemCount > 50 ? 10 : 5;
      let idx = 1;
      while (idx <= itemCount) {
        const end = Math.min(idx + batchSize - 1, itemCount);
        const batchNum = Math.ceil(idx / batchSize);
        const totalBatches = Math.ceil(itemCount / batchSize);
        const priority = batchNum <= Math.ceil(totalBatches * 0.3) ? "high"
          : batchNum <= Math.ceil(totalBatches * 0.7) ? "medium" : "low";

        tasks.push({
          title: `${cat.emoji} ${actionVerb} ${itemLabel}s #${idx}-${end}`,
          durationMinutes: Math.min(durationPerItem * (end - idx + 1), 480),
          priority: priority as GeneratedTask["priority"],
          energyType: cat.energyType,
        });
        idx = end + 1;
      }
    }

    // Add contextual prep/review tasks if the project seems substantial
    if (itemCount >= 3 && durationPerItem >= 30) {
      // Add a setup/planning task at the start
      const setupCat = categorizeTask("plan organize");
      tasks.unshift({
        title: `${setupCat.emoji} Set up project & organize source material`,
        durationMinutes: Math.min(Math.max(30, Math.round(durationPerItem * 0.5)), 120),
        priority: "high",
        energyType: "admin",
      });

      // Add a review/finalize task at the end
      if (itemCount >= 5) {
        const reviewCat = categorizeTask("review");
        tasks.push({
          title: `${reviewCat.emoji} Final review & quality check`,
          durationMinutes: Math.min(Math.max(30, Math.round(itemCount * 5)), 120),
          priority: "medium",
          energyType: "admin",
        });
      }

      // Add an upload/publish/deliver task at the very end
      const hasDelivery = lower.includes("upload") || lower.includes("publish") ||
        lower.includes("send") || lower.includes("deliver") || lower.includes("post") ||
        lower.includes("submit") || lower.includes("export");
      if (hasDelivery || itemCount >= 5) {
        const deliveryCat = categorizeTask(
          lower.includes("upload") ? "upload" :
          lower.includes("publish") ? "publish" :
          lower.includes("post") ? "post" : "upload"
        );
        tasks.push({
          title: `${deliveryCat.emoji} Export & deliver all ${itemLabel.toLowerCase()}s`,
          durationMinutes: Math.min(Math.max(15, itemCount * 3), 120),
          priority: "low",
          energyType: "light",
        });
      }
    }
  }
  // --- Case 2: Comma/semicolon-separated list of things to do ---
  else {
    const segments = prompt
      .split(/[,\n;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3 && s.length < 150);

    // Deduplicate near-identical segments
    const unique = segments.filter((s, i) =>
      segments.findIndex((t) => t.toLowerCase() === s.toLowerCase()) === i
    );

    if (unique.length >= 2) {
      // User listed specific tasks — use them directly
      unique.slice(0, 20).forEach((seg, i) => {
        const cat = categorizeTask(seg);
        const segDuration = extractDuration(seg);
        const cleaned = seg
          .replace(/\d+\s*(hours?|hrs?|minutes?|mins?)\s*/gi, "")
          .replace(/^\s*[-–•]\s*/, "")
          .trim();
        const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

        tasks.push({
          title: `${cat.emoji} ${title}`,
          durationMinutes: segDuration || durationPerItem,
          priority: i === 0 ? "high" : i < unique.length / 2 ? "medium" : "low",
          energyType: cat.energyType,
        });
      });
    } else {
      // --- Case 3: Single-sentence project description ---
      // Break it down based on what we understand about the project
      const projectCat = categorizeTask(prompt);
      const actionVerb = verb || "Work on";

      // Try to infer a sensible breakdown based on keywords
      const phases = inferProjectPhases(lower, actionVerb, projectCat.emoji);

      phases.forEach((phase, i) => {
        const pCat = categorizeTask(phase.title);
        tasks.push({
          title: `${pCat.emoji} ${phase.title}`,
          durationMinutes: phase.durationMinutes || durationPerItem,
          priority: phase.priority || (i === 0 ? "high" : i < phases.length / 2 ? "medium" : "low"),
          energyType: pCat.energyType,
        });
      });
    }
  }

  // Pick a color based on the dominant energy type
  const energyCounts: Record<string, number> = {};
  for (const t of tasks) {
    energyCounts[t.energyType] = (energyCounts[t.energyType] || 0) + 1;
  }
  const dominantEnergy = Object.entries(energyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "deep";
  const projectColor = ENERGY_TO_COLOR[dominantEnergy] || "indigo";

  return {
    name: projectName,
    description,
    color: projectColor,
    tasks,
  };
}

interface PhaseTemplate {
  title: string;
  durationMinutes?: number;
  priority?: "high" | "medium" | "low";
}

function inferProjectPhases(lower: string, verb: string, emoji: string): PhaseTemplate[] {
  // Video/film project
  if (lower.match(/video|film|documentary|movie|short|youtube|clip|reel|animation/)) {
    return [
      { title: "Review source footage & plan edits", durationMinutes: 60, priority: "high" },
      { title: "Rough cut editing", durationMinutes: 120, priority: "high" },
      { title: "Fine cut & transitions", durationMinutes: 90, priority: "medium" },
      { title: "Add music, sound effects & audio mix", durationMinutes: 60, priority: "medium" },
      { title: "Color grading & visual polish", durationMinutes: 45, priority: "medium" },
      { title: "Add titles, captions & graphics", durationMinutes: 30, priority: "low" },
      { title: "Render & export final version", durationMinutes: 30, priority: "low" },
      { title: "Upload & publish", durationMinutes: 15, priority: "low" },
    ];
  }
  // Writing project
  if (lower.match(/write|essay|article|blog|book|story|script|copy|content/)) {
    return [
      { title: "Research & gather references", durationMinutes: 60, priority: "high" },
      { title: "Create outline & structure", durationMinutes: 30, priority: "high" },
      { title: "Write first draft", durationMinutes: 120, priority: "high" },
      { title: "Revise & edit", durationMinutes: 60, priority: "medium" },
      { title: "Proofread & polish", durationMinutes: 30, priority: "medium" },
      { title: "Format & publish", durationMinutes: 20, priority: "low" },
    ];
  }
  // Design project
  if (lower.match(/design|logo|brand|ui|ux|mockup|wireframe|layout|graphic/)) {
    return [
      { title: "Research & mood board", durationMinutes: 45, priority: "high" },
      { title: "Initial sketches & concepts", durationMinutes: 60, priority: "high" },
      { title: "Create main design", durationMinutes: 120, priority: "high" },
      { title: "Iterate on feedback", durationMinutes: 60, priority: "medium" },
      { title: "Finalize assets & export", durationMinutes: 30, priority: "low" },
    ];
  }
  // Development project
  if (lower.match(/code|app|website|software|develop|build|program|api|database|frontend|backend/)) {
    return [
      { title: "Plan architecture & tech stack", durationMinutes: 60, priority: "high" },
      { title: "Set up project & boilerplate", durationMinutes: 45, priority: "high" },
      { title: "Build core functionality", durationMinutes: 180, priority: "high" },
      { title: "Build secondary features", durationMinutes: 120, priority: "medium" },
      { title: "Testing & bug fixes", durationMinutes: 90, priority: "medium" },
      { title: "Deploy & documentation", durationMinutes: 45, priority: "low" },
    ];
  }
  // Music/audio project
  if (lower.match(/music|song|beat|mix|master|album|podcast|audio|record/)) {
    return [
      { title: "Plan structure & arrangement", durationMinutes: 30, priority: "high" },
      { title: "Record or compose main parts", durationMinutes: 120, priority: "high" },
      { title: "Edit & clean up takes", durationMinutes: 60, priority: "medium" },
      { title: "Mix & balance", durationMinutes: 60, priority: "medium" },
      { title: "Master final version", durationMinutes: 30, priority: "low" },
      { title: "Export & distribute", durationMinutes: 15, priority: "low" },
    ];
  }
  // Marketing/social media project
  if (lower.match(/market|social|campaign|ads?|launch|promo|brand|seo|newsletter/)) {
    return [
      { title: "Research target audience & competitors", durationMinutes: 60, priority: "high" },
      { title: "Define strategy & messaging", durationMinutes: 45, priority: "high" },
      { title: "Create content & assets", durationMinutes: 120, priority: "high" },
      { title: "Set up campaigns & scheduling", durationMinutes: 60, priority: "medium" },
      { title: "Launch & monitor performance", durationMinutes: 30, priority: "medium" },
      { title: "Analyze results & optimize", durationMinutes: 45, priority: "low" },
    ];
  }
  // Event/planning project
  if (lower.match(/event|party|wedding|conference|meetup|workshop|class|course/)) {
    return [
      { title: "Define goals, budget & timeline", durationMinutes: 45, priority: "high" },
      { title: "Book venue & arrange logistics", durationMinutes: 60, priority: "high" },
      { title: "Prepare materials & content", durationMinutes: 90, priority: "medium" },
      { title: "Send invitations & promote", durationMinutes: 30, priority: "medium" },
      { title: "Run through & rehearse", durationMinutes: 45, priority: "low" },
      { title: "Day-of execution & follow-up", durationMinutes: 60, priority: "low" },
    ];
  }
  // Study/learning project
  if (lower.match(/study|learn|course|exam|certification|homework|assignment|tutor/)) {
    return [
      { title: "Gather materials & resources", durationMinutes: 30, priority: "high" },
      { title: "Study core concepts", durationMinutes: 120, priority: "high" },
      { title: "Practice exercises & problems", durationMinutes: 90, priority: "high" },
      { title: "Review notes & weak areas", durationMinutes: 60, priority: "medium" },
      { title: "Take practice test", durationMinutes: 60, priority: "low" },
    ];
  }

  // Generic fallback — still try to make it relevant
  return [
    { title: `Research & plan: ${verb.toLowerCase()} approach`, durationMinutes: 45, priority: "high" },
    { title: `${verb} — main work session 1`, durationMinutes: 120, priority: "high" },
    { title: `${verb} — main work session 2`, durationMinutes: 120, priority: "medium" },
    { title: "Review progress & iterate", durationMinutes: 45, priority: "medium" },
    { title: "Final polish & deliver", durationMinutes: 30, priority: "low" },
  ];
}

// ---- Follow-up questions ----

const followUpSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      type: z.enum(["text", "select", "date", "number"]),
      options: z.array(z.string()).optional(),
      placeholder: z.string().optional(),
    })
  ),
});

function generateLocalFollowUpQuestions(prompt: string): FollowUpQuestion[] {
  const lower = prompt.toLowerCase();
  const questions: FollowUpQuestion[] = [
    {
      id: "deadline",
      question: "When do you need this completed by?",
      type: "date",
      placeholder: "Select a deadline",
    },
    {
      id: "hours_per_day",
      question: "How many hours per day can you work on this?",
      type: "number",
      placeholder: "e.g. 4",
    },
    {
      id: "time_preference",
      question: "When do you prefer to work on this?",
      type: "select",
      options: ["Morning", "Afternoon", "Evening", "No preference"],
    },
  ];

  if (lower.match(/video|film|edit|short|reel|clip|youtube/)) {
    questions.push({
      id: "phase_detail",
      question: "What phases does each item involve?",
      type: "select",
      options: ["Full production (film + edit + publish)", "Edit & publish only", "Just editing", "Custom workflow"],
    });
  } else if (lower.match(/write|blog|article|essay|book|content/)) {
    questions.push({
      id: "phase_detail",
      question: "What does each piece involve?",
      type: "select",
      options: ["Research + write + edit", "Write & edit only", "Just writing drafts", "Full pipeline with publishing"],
    });
  } else if (lower.match(/code|app|website|build|develop|software/)) {
    questions.push({
      id: "phase_detail",
      question: "What development approach do you want?",
      type: "select",
      options: ["MVP first, then iterate", "Full build all at once", "Feature by feature", "Prototype then polish"],
    });
  } else {
    questions.push({
      id: "detail_level",
      question: "How detailed should the task breakdown be?",
      type: "select",
      options: ["High-level milestones", "Detailed step-by-step", "Balanced mix"],
    });
  }

  questions.push({
    id: "extra_context",
    question: "Anything else the AI should know about this project?",
    type: "text",
    placeholder: "e.g. I'm a beginner, working solo, have specific tools...",
  });

  return questions;
}

export async function generateFollowUpQuestions(
  prompt: string
): Promise<{ questions: FollowUpQuestion[] }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  let client;
  let model;
  try {
    const result = await getOpenAIClient(session.user.id);
    client = result.client;
    model = result.model;
  } catch {
    return { questions: generateLocalFollowUpQuestions(prompt) };
  }

  const systemPrompt = `You are a project planning assistant. The user described a project and you need to ask 3-5 clarifying questions to understand scope, timeline, and constraints before generating a plan.

Rules:
1. ALWAYS include a deadline question (type: "date").
2. ALWAYS include a question about daily available hours (type: "number").
3. Ask 1-3 more questions relevant to the specific project — about phases, preferences, skill level, tools, etc.
4. For "select" type questions, provide 3-4 concrete options.
5. Each question needs: id (unique snake_case), question (clear text), type ("text"|"select"|"date"|"number"), options (only for "select"), placeholder (for text/number).
6. Keep questions concise and practical.

Respond with valid JSON matching this structure:
{
  "questions": [
    { "id": "deadline", "question": "...", "type": "date" },
    { "id": "hours_per_day", "question": "...", "type": "number", "placeholder": "e.g. 4" },
    ...
  ]
}`;

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) throw new Error("No response");

    const parsed = followUpSchema.parse(JSON.parse(responseText));
    return parsed;
  } catch {
    return { questions: generateLocalFollowUpQuestions(prompt) };
  }
}

// ---- Main export ----

export async function generateProjectWithAI(
  prompt: string,
  answers?: { question: string; answer: string }[]
): Promise<GeneratedProject> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  let client;
  let model;
  try {
    const result = await getOpenAIClient(session.user.id);
    client = result.client;
    model = result.model;
  } catch {
    // No API key configured — use local fallback
    return generateProjectLocally(prompt);
  }

  // Build enhanced user message with Q&A context
  let userMessage = prompt;
  if (answers && answers.length > 0) {
    const qaBlock = answers
      .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
      .join("\n\n");
    userMessage = `Project description: ${prompt}\n\nAdditional context from interview:\n${qaBlock}`;
  }

  const systemPrompt = `You are a project planning assistant. Given a project description (and optionally follow-up answers), generate a structured project plan with tasks.

Rules:
1. Create a concise project name (max 50 chars).
2. Write a brief description (1-2 sentences).
3. Choose a color from: indigo, emerald, amber, rose, cyan, violet, orange.
4. Break the project into actionable, SPECIFIC tasks — not generic placeholders. Each title should describe exactly what to do.
5. Prefix every task title with a relevant emoji (e.g. 🎬 Edit Short #1, 📋 Plan shoot schedule).
6. If the user mentions N items (e.g. "20 videos"), create a task for EACH individual item.
7. Insert checkpoint/milestone tasks between groups of related work (e.g. "🏁 Checkpoint: First 5 shorts complete").
8. Each task needs: title (with emoji), durationMinutes (15-480), priority (high/medium/low), energyType (deep/light/admin).
9. If a deadline was provided, pace the work to fit within it.
10. Order tasks logically (dependencies first).
11. Set realistic durations based on context.
12. Add prep/setup tasks at the start and review/delivery tasks at the end where appropriate.

Respond with valid JSON only.`;

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from AI");
    }

    return aiResponseSchema.parse(JSON.parse(responseText));
  } catch (err: unknown) {
    // On quota/rate-limit/network errors, fall back to local generation
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("429") ||
      message.includes("quota") ||
      message.includes("rate") ||
      message.includes("billing") ||
      message.includes("insufficient_quota")
    ) {
      return generateProjectLocally(prompt);
    }
    throw new Error(message || "AI generation failed. Please try again.");
  }
}
