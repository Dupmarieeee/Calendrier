import { addDays, diffDays, maxDate, minDate, slotMinutes, weekday } from './dates';
import type { AppState, Category, Habit, ISODate, Item } from './types';

export const UNCATEGORIZED: Category = { id: '__none', name: 'Sans catégorie', color: '#7d8597' };

export interface CategoryTotal {
  category: Category;
  minutes: number;
  perDay: number[];
}

export interface WeekStats {
  days: ISODate[];
  totals: CategoryTotal[]; // triées par durée décroissante
  totalMinutes: number;
  perDay: number[];
  untimedCount: number;
}

export function itemMinutes(it: Item): number {
  if (!it.start || !it.end) return 0;
  return slotMinutes(it.start, it.end);
}

/** Temps planifié par catégorie sur une semaine. Les tâches sans créneau sont exclues. */
export function weekStats(state: AppState, days: ISODate[]): WeekStats {
  const idx = new Map(days.map((d, i) => [d, i]));
  const byCat = new Map<string, CategoryTotal>();
  const catMap = new Map(state.categories.map((c) => [c.id, c]));
  let untimed = 0;
  const perDay = days.map(() => 0);
  for (const it of Object.values(state.items)) {
    const i = idx.get(it.date);
    if (i === undefined) continue;
    const min = itemMinutes(it);
    if (!min) {
      untimed++;
      continue;
    }
    const cat = (it.categoryId && catMap.get(it.categoryId)) || UNCATEGORIZED;
    let t = byCat.get(cat.id);
    if (!t) {
      t = { category: cat, minutes: 0, perDay: days.map(() => 0) };
      byCat.set(cat.id, t);
    }
    t.minutes += min;
    t.perDay[i] += min;
    perDay[i] += min;
  }
  // Ordre stable : l'ordre des catégories définies par l'utilisateur (la couleur suit l'entité).
  const order = new Map(state.categories.map((c, i) => [c.id, i]));
  const totals = [...byCat.values()].sort((a, b) => (order.get(a.category.id) ?? 999) - (order.get(b.category.id) ?? 999));
  return { days, totals, totalMinutes: perDay.reduce((a, b) => a + b, 0), perDay, untimedCount: untimed };
}

// ---------------------------------------------------------------- Habitudes

export function isScheduled(h: Habit, date: ISODate, state: AppState): boolean {
  if (h.archived) return false;
  const { startDate, endDate } = state.challenge;
  if (date < startDate || date > endDate || date < h.since) return false;
  return !h.days || h.days.includes(weekday(date));
}

export function habitsForDay(state: AppState, date: ISODate): Habit[] {
  return state.habits.filter((h) => isScheduled(h, date, state));
}

export function dayScore(state: AppState, date: ISODate): { done: number; total: number } {
  const hs = habitsForDay(state, date);
  const log = state.habitLog[date] ?? {};
  return { done: hs.filter((h) => log[h.id]).length, total: hs.length };
}

export interface HabitRate {
  habit: Habit;
  done: number;
  scheduled: number;
  rate: number; // 0..1
}

/** Taux de réussite d'une habitude entre le début du challenge et aujourd'hui (inclus). */
export function habitRate(state: AppState, h: Habit, today: ISODate): HabitRate {
  const from = maxDate(state.challenge.startDate, h.since);
  const to = minDate(today, state.challenge.endDate);
  let done = 0;
  let scheduled = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isScheduled(h, d, state)) continue;
    scheduled++;
    if (state.habitLog[d]?.[h.id]) done++;
  }
  return { habit: h, done, scheduled, rate: scheduled ? done / scheduled : 0 };
}

export interface ChallengeProgress {
  totalDays: number;
  dayIndex: number; // 1-based, borné à [0, totalDays]
  elapsedDays: number;
  done: number;
  scheduled: number;
  rate: number;
  currentStreak: number;
  bestStreak: number;
  perfectDays: number;
}

export function challengeProgress(state: AppState, today: ISODate): ChallengeProgress {
  const { startDate, endDate } = state.challenge;
  const totalDays = diffDays(endDate, startDate) + 1;
  const dayIndex = Math.max(0, Math.min(totalDays, diffDays(today, startDate) + 1));
  const last = minDate(today, endDate);
  let done = 0;
  let scheduled = 0;
  let run = 0;
  let best = 0;
  let perfect = 0;
  for (let d = startDate; d <= last; d = addDays(d, 1)) {
    const s = dayScore(state, d);
    done += s.done;
    scheduled += s.total;
    const ok = s.total > 0 && s.done === s.total;
    if (ok) {
      perfect++;
      run++;
      best = Math.max(best, run);
    } else if (s.total > 0 && d !== today) run = 0;
  }
  // Série en cours : jours parfaits consécutifs jusqu'à aujourd'hui (aujourd'hui non terminé ne casse pas la série).
  let current = 0;
  for (let d = last; d >= startDate; d = addDays(d, -1)) {
    const s = dayScore(state, d);
    if (s.total === 0) continue;
    if (s.done === s.total) current++;
    else if (d === today) continue;
    else break;
  }
  return {
    totalDays,
    dayIndex,
    elapsedDays: Math.max(0, diffDays(last, startDate) + 1),
    done,
    scheduled,
    rate: scheduled ? done / scheduled : 0,
    currentStreak: current,
    bestStreak: best,
    perfectDays: perfect,
  };
}
