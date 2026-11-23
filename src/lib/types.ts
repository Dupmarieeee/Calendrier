// Modèle de données de l'application. Toutes les dates sont des chaînes
// « AAAA-MM-JJ » et les heures « HH:mm », exprimées dans le fuseau Europe/Paris.

export type ISODate = string; // 2026-11-23
export type HHMM = string; // 09:30

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

/** Lien entre un élément de l'app et un événement Google Agenda. */
export interface GoogleLink {
  calendarId: string;
  eventId: string;
  etag?: string;
  updated?: string; // RFC3339 renvoyé par Google
  recurringEventId?: string; // présent pour une occurrence d'événement récurrent
  readOnly?: boolean; // calendrier en lecture seule
  htmlLink?: string;
}

export type ItemKind = 'event' | 'task';

export interface Item {
  id: string;
  kind: ItemKind;
  title: string;
  date: ISODate;
  /** Dernier jour (inclus) pour un élément sur plusieurs journées entières. */
  endDate?: ISODate;
  /** Heure de début ; null = pas de créneau (journée entière / tâche datée). */
  start: HHMM | null;
  end: HHMM | null;
  categoryId: string | null;
  notes: string;
  subtasks: Subtask[];
  done: boolean;
  /** Créé dans l'app ou importé depuis Google. */
  origin: 'app' | 'google';
  /** Pour un élément créé dans l'app : l'envoyer vers Google Agenda. */
  sync: boolean;
  g?: GoogleLink;
  /** Série créée dans l'app (répétition). */
  seriesId?: string;
  /** Modifications locales pas encore envoyées à Google. */
  dirty?: boolean;
  rev: number;
  createdAt: number;
  updatedAt: number;
}

export type RepeatFreq = 'daily' | 'weekdays' | 'weekly';

export interface Series {
  id: string;
  freq: RepeatFreq;
  /** Jours de la semaine (0 = lundi … 6 = dimanche) pour « weekly ». */
  byDay?: number[];
  startDate: ISODate;
  until: ISODate;
  sync: boolean;
  /** Événement « maître » récurrent dans Google une fois envoyé. */
  g?: { calendarId: string; masterId: string };
  /** Dates d'occurrences supprimées avant d'être liées à Google. */
  exdates: ISODate[];
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  target: string; // ex. « 12 000 pas »
  /** null = tous les jours, sinon jours de la semaine (0 = lundi). */
  days: number[] | null;
  since: ISODate;
  archived?: boolean;
  createdAt: number;
}

export interface Challenge {
  name: string;
  startDate: ISODate;
  endDate: ISODate;
}

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  color: string;
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader';
  primary?: boolean;
}

export interface PendingDelete {
  calendarId: string;
  eventId: string;
}

/** Modification d'une série récurrente Google entière (événement maître). */
export interface MasterPatch {
  calendarId: string;
  masterId: string;
  title?: string;
  notes?: string;
  start?: HHMM;
  end?: HHMM;
  remove?: boolean;
}

export interface GoogleState {
  session?: string; // jeton chiffré par le serveur
  email?: string;
  connectedAt?: number;
  calendars: GoogleCalendarInfo[];
  selected: string[];
  targetCalendarId?: string;
  calendarCategory: Record<string, string | null>;
  defaultSync: boolean;
  lastSyncAt?: number;
  lastError?: string;
  /** « expired » quand Google a révoqué l'accès. */
  authError?: boolean;
  pendingDeletes: PendingDelete[];
  masterPatches: MasterPatch[];
}

export type ThemePref = 'system' | 'dark' | 'light';

export interface AppState {
  version: 1;
  categories: Category[];
  items: Record<string, Item>;
  series: Record<string, Series>;
  challenge: Challenge;
  habits: Habit[];
  /** date → id d'habitude → validée */
  habitLog: Record<ISODate, Record<string, boolean>>;
  google: GoogleState;
  settings: { theme: ThemePref; name?: string };
}
