// Calculs de dates indépendants du fuseau de l'appareil : on manipule des
// chaînes « AAAA-MM-JJ » via des dates UTC, et on convertit les instants réels
// vers Europe/Paris avec Intl.
import type { HHMM, ISODate } from './types';

export const APP_TZ = 'Europe/Paris';

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const JOURS_LETTRE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
export const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const pad = (n: number) => String(n).padStart(2, '0');

export function parseISO(d: ISODate): { y: number; m: number; d: number } {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, d: day };
}

export function toUTC(d: ISODate): number {
  const p = parseISO(d);
  return Date.UTC(p.y, p.m - 1, p.d);
}

export function fromUTC(ms: number): ISODate {
  const x = new Date(ms);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * 86400000);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a) - toUTC(b)) / 86400000);
}

/** 0 = lundi … 6 = dimanche */
export function weekday(d: ISODate): number {
  return (new Date(toUTC(d)).getUTCDay() + 6) % 7;
}

export function startOfWeek(d: ISODate): ISODate {
  return addDays(d, -weekday(d));
}

export function weekDays(d: ISODate): ISODate[] {
  const s = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

export function isoWeek(d: ISODate): number {
  // Jeudi de la même semaine ISO
  const thursday = addDays(d, 3 - weekday(d));
  const year = parseISO(thursday).y;
  const jan4 = `${year}-01-04`;
  return 1 + Math.round(diffDays(startOfWeek(thursday), startOfWeek(jan4)) / 7);
}

export function startOfMonth(d: ISODate): ISODate {
  const p = parseISO(d);
  return `${p.y}-${pad(p.m)}-01`;
}

export function addMonths(d: ISODate, n: number): ISODate {
  const p = parseISO(d);
  const x = new Date(Date.UTC(p.y, p.m - 1 + n, 1));
  return fromUTC(x.getTime());
}

export function daysInMonth(d: ISODate): number {
  const p = parseISO(d);
  return new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
}

export function minDate(a: ISODate, b: ISODate) {
  return a < b ? a : b;
}
export function maxDate(a: ISODate, b: ISODate) {
  return a > b ? a : b;
}

// ---------- Heures ----------

export function toMinutes(t: HHMM): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): HHMM {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  if (m === 24 * 60) return '24:00';
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Durée en minutes d'un créneau ; une fin ≤ début signifie « le lendemain ». */
export function slotMinutes(start: HHMM, end: HHMM): number {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 24 * 60;
  return e - s;
}

export function formatDuration(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${pad(r)}`;
}

export function formatHour(t: HHMM): string {
  const [h, m] = t.split(':');
  return `${Number(h)}:${m}`;
}

// ---------- Fuseau Europe/Paris ----------

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function parisFields(ms: number) {
  const o: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(new Date(ms))) o[p.type] = p.value;
  return {
    y: Number(o.year),
    m: Number(o.month),
    d: Number(o.day),
    h: Number(o.hour) % 24,
    mi: Number(o.minute),
    s: Number(o.second),
  };
}

/** Instant → date et heure murales à Paris. */
export function toParis(ms: number): { date: ISODate; time: HHMM } {
  const f = parisFields(ms);
  return { date: `${f.y}-${pad(f.m)}-${pad(f.d)}`, time: `${pad(f.h)}:${pad(f.mi)}` };
}

/** Décalage (ms) de Paris par rapport à UTC à un instant donné. */
function parisOffset(ms: number): number {
  const f = parisFields(ms);
  return Date.UTC(f.y, f.m - 1, f.d, f.h, f.mi, f.s) - Math.floor(ms / 1000) * 1000;
}

/** Date et heure murales à Paris → instant (ms). Gère les changements d'heure. */
export function fromParis(date: ISODate, time: HHMM): number {
  const p = parseISO(date);
  const mins = toMinutes(time);
  const naive = Date.UTC(p.y, p.m - 1, p.d) + mins * 60000;
  let guess = naive - parisOffset(naive);
  const off2 = parisOffset(guess);
  guess = naive - off2;
  return guess;
}

export function todayParis(now = Date.now()): ISODate {
  return toParis(now).date;
}

export function nowParisMinutes(now = Date.now()): number {
  return toMinutes(toParis(now).time);
}

// ---------- Libellés ----------

export function labelDay(d: ISODate): string {
  const p = parseISO(d);
  return `${JOURS[weekday(d)]} ${p.d} ${MOIS[p.m - 1]}`;
}

export function labelDayShort(d: ISODate): string {
  const p = parseISO(d);
  return `${JOURS_COURTS[weekday(d)]} ${p.d} ${MOIS_COURTS[p.m - 1]}`;
}

export function labelMonthYear(d: ISODate): string {
  const p = parseISO(d);
  const m = MOIS[p.m - 1];
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${p.y}`;
}

export function labelRange(a: ISODate, b: ISODate): string {
  const pa = parseISO(a);
  const pb = parseISO(b);
  if (pa.m === pb.m) return `${pa.d} – ${pb.d} ${MOIS_COURTS[pb.m - 1]}`;
  return `${pa.d} ${MOIS_COURTS[pa.m - 1]} – ${pb.d} ${MOIS_COURTS[pb.m - 1]}`;
}

export function labelDate(d: ISODate): string {
  const p = parseISO(d);
  return `${p.d} ${MOIS_COURTS[p.m - 1]} ${p.y}`;
}

export function relativeTime(ms: number, now = Date.now()): string {
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return "à l'instant";
  if (diff < 3600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  const a = toParis(ms);
  const today = todayParis(now);
  if (a.date === today) return `aujourd'hui à ${formatHour(a.time)}`;
  if (a.date === addDays(today, -1)) return `hier à ${formatHour(a.time)}`;
  return `${labelDayShort(a.date)} à ${formatHour(a.time)}`;
}
