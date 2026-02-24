export type Priority = "high" | "medium" | "low";
export type EnergyType = "deep" | "light" | "admin";
export type TimeWindow = "morning" | "afternoon" | "evening" | null;

export interface TaskFormData {
  title: string;
  durationMinutes: number;
  deadline: string | null;
  priority: Priority;
  energyType: EnergyType;
  preferredTimeWindow: TimeWindow;
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
}

export interface ScheduleAssignment {
  taskId: string;
  title: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  color: string;
}
