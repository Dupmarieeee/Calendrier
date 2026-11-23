// Conversion entre événements Google Agenda et éléments de l'application.
import { addDays, APP_TZ, fromParis, toParis } from '../dates';
import type { Item, ISODate } from '../types';

export interface GDateTime {
  date?: string; // journée entière
  dateTime?: string; // RFC3339
  timeZone?: string;
}

export interface GEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  etag?: string;
  updated?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: GDateTime;
  end?: GDateTime;
  recurringEventId?: string;
  originalStartTime?: GDateTime;
  recurrence?: string[];
  extendedProperties?: { private?: Record<string, string> };
}

export interface ItemTimeFields {
  date: ISODate;
  endDate?: ISODate;
  start: string | null;
  end: string | null;
}

/** Heures/dates Google → champs « muraux » Europe/Paris. */
export function timeFieldsFromGoogle(ev: GEvent): ItemTimeFields | null {
  if (!ev.start) return null;
  if (ev.start.date) {
    const date = ev.start.date;
    // La date de fin Google est exclusive.
    const lastDay = ev.end?.date ? addDays(ev.end.date, -1) : date;
    return { date, endDate: lastDay > date ? lastDay : undefined, start: null, end: null };
  }
  if (!ev.start.dateTime) return null;
  const s = toParis(Date.parse(ev.start.dateTime));
  const endMs = ev.end?.dateTime ? Date.parse(ev.end.dateTime) : Date.parse(ev.start.dateTime) + 3600_000;
  const e = toParis(endMs);
  return { date: s.date, start: s.time, end: e.time };
}

export function originalDate(ev: GEvent): ISODate | undefined {
  const o = ev.originalStartTime;
  if (!o) return undefined;
  if (o.date) return o.date;
  if (o.dateTime) return toParis(Date.parse(o.dateTime)).date;
  return undefined;
}

const fmtLocal = (date: ISODate, time: string) => `${date}T${time === '24:00' ? '23:59' : time}:00`;

/** Champs « muraux » → start/end Google (fuseau Europe/Paris explicite). */
export function googleTimes(it: Pick<Item, 'date' | 'endDate' | 'start' | 'end'>): { start: GDateTime; end: GDateTime } {
  if (!it.start) {
    const last = it.endDate && it.endDate > it.date ? it.endDate : it.date;
    return { start: { date: it.date }, end: { date: addDays(last, 1) } };
  }
  const end = it.end ?? it.start;
  // Fin ≤ début : l'événement se termine le lendemain.
  const endDate = end <= it.start ? addDays(it.date, 1) : it.date;
  return {
    start: { dateTime: fmtLocal(it.date, it.start), timeZone: APP_TZ },
    end: { dateTime: fmtLocal(endDate, end), timeZone: APP_TZ },
  };
}

export function eventBody(it: Item): Partial<GEvent> {
  return {
    summary: it.title,
    description: it.notes || '',
    ...googleTimes(it),
    extendedProperties: { private: { givreId: it.id } },
  };
}

/** Instant (ms) de début de journée à Paris, pour timeMin/timeMax. */
export function dayStartRFC(date: ISODate): string {
  return new Date(fromParis(date, '00:00')).toISOString();
}
