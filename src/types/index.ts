export type Priority = "high" | "medium" | "low";
export type EnergyType = "deep" | "light" | "admin";
export type TimeWindow = "morning" | "afternoon" | "evening" | null;
export type ProjectStatus = "active" | "completed" | "archived";
export type ProjectColor = "indigo" | "emerald" | "amber" | "gray" | "rose" | "cyan" | "violet" | "orange";
export type CalendarViewMode = "day" | "4day" | "week" | "month";
export type Availability = "busy" | "free_tight" | "free_light" | "free";

export interface TaskFormData {
  title: string;
  durationMinutes: number;
  deadline: string | null;
  priority: Priority;
  energyType: EnergyType;
  preferredTimeWindow: TimeWindow;
  projectId?: string | null;
}

export interface GeneratedTask {
  title: string;
  durationMinutes: number;
  priority: Priority;
  energyType: EnergyType;
}

export interface GeneratedProject {
  name: string;
  description: string;
  color: ProjectColor;
  tasks: GeneratedTask[];
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  type: "text" | "select" | "date" | "number";
  options?: string[];
  placeholder?: string;
}

export interface PreferencesFormData {
  workStartTime: string;
  workEndTime: string;
  workDays: string;
  deepWorkStart: string;
  deepWorkEnd: string;
  breakMinutes: number;
  timezone: string;
  openaiApiKey: string;
  openaiModel: string;
}

export interface FreeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
  /** Which energy types are allowed in this slot. If undefined, all types allowed. */
  allowedEnergy?: EnergyType[];
}

export interface ScheduleAssignment {
  taskId: string;
  title: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  color: string;
}

export interface MetricDefinition {
  id: string;
  name: string;
  unit: string;
  icon: string;
  category: string;
  aggregation: "sum" | "max" | "avg" | "last";
  isPreset: boolean;
}

export interface MetricEntry {
  id: string;
  metricId: string;
  taskId?: string;
  value: number;
  date: string;
  notes?: string;
  metric?: MetricDefinition;
}
