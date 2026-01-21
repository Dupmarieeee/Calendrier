export interface Category {
  id: string;
  name: string;
  color: string;
  lightColor: string;
}

export interface Task {
  id: string;
  title: string;
  categoryId: string;
  date: string; // ISO string YYYY-MM-DD
  startTime: string; // HH:mm
  durationHours: number;
  isCompleted: boolean;
  actualSeconds: number;
  isRunning?: boolean;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  type: 'daily' | 'weekly';
  date: string; // For daily: YYYY-MM-DD, For weekly: Year-WkNum
}

export interface SleepSchedule {
  enabled: boolean;
  bedtime: string; // HH:mm
  wakeTime: string; // HH:mm
}

export type GrowthType = 'fleur' | 'arbre' | 'animal' | 'humain';

export interface GrowthState {
  type: GrowthType;
  totalPoints: number;
  lastPointsUpdate: string; // Date ISO
  streak: number;
}