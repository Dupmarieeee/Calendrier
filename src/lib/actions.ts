// Mutations pures de l'état (state → nouvel état). Utilisées par l'interface
// et testées unitairement.
import { addDays, diffDays, todayParis, weekday } from './dates';
import type {
  AppState, Category, Habit, Item, ISODate, RepeatFreq, Series,
} from './types';

/** Identifiant hexadécimal : compatible avec les ID d'événements Google (base32hex). */
export function newId(): string {
  const bytes = new Uint8Array(13);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const CATEGORY_COLORS = [
  '#3987e5', // bleu
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // jaune
  '#d55181', // magenta
  '#0ca30c', // vert
  '#9085e9', // violet
  '#e66767', // rouge
];

export const HABIT_COLORS = ['#d4f57a', '#7cc4ff', '#ffb86b', '#c9a7ff', '#ff8fb1', '#6fe3c1'];

export function defaultState(now = Date.now()): AppState {
  const today = todayParis(now);
  const cats: Category[] = [
    { id: 'cat-travail', name: 'Travail', color: CATEGORY_COLORS[0] },
    { id: 'cat-sport', name: 'Sport', color: CATEGORY_COLORS[1] },
    { id: 'cat-perso', name: 'Perso', color: CATEGORY_COLORS[6] },
    { id: 'cat-deplacements', name: 'Déplacements', color: CATEGORY_COLORS[3] },
  ];
  const habit = (name: string, emoji: string, target: string, color: string, days: number[] | null): Habit => ({
    id: newId(), name, emoji, target, color, days, since: today, createdAt: now,
  });
  return {
    version: 1,
    categories: cats,
    items: {},
    series: {},
    challenge: { name: 'Winter Arc', startDate: today, endDate: addDays(today, 89) },
    habits: [
      habit('Marcher', '👟', '12 000 pas', HABIT_COLORS[0], null),
      habit('Boire de l’eau', '💧', '2,5 L', HABIT_COLORS[1], null),
      habit('Créatine', '💊', '5 g', HABIT_COLORS[3], null),
      habit('Séance de sport', '🏋️', '1 séance', HABIT_COLORS[2], [0, 2, 4]),
    ],
    habitLog: {},
    google: {
      calendars: [],
      selected: [],
      calendarCategory: {},
      defaultSync: true,
      pendingDeletes: [],
      masterPatches: [],
    },
    settings: { theme: 'system' },
  };
}

// ---------------------------------------------------------------- Éléments

export interface ItemDraft {
  kind: Item['kind'];
  title: string;
  date: ISODate;
  endDate?: ISODate;
  start: string | null;
  end: string | null;
  categoryId: string | null;
  notes: string;
  subtasks: Item['subtasks'];
  done?: boolean;
  sync: boolean;
}

export interface RepeatDraft {
  freq: RepeatFreq;
  byDay?: number[];
  until: ISODate;
}

export function seriesDates(s: Pick<Series, 'freq' | 'byDay' | 'startDate' | 'until'>, max = 400): ISODate[] {
  const out: ISODate[] = [];
  const days = s.freq === 'weekly'
    ? (s.byDay && s.byDay.length ? s.byDay : [weekday(s.startDate)])
    : s.freq === 'weekdays' ? [0, 1, 2, 3, 4] : null;
  for (let d = s.startDate; d <= s.until && out.length < max; d = addDays(d, 1)) {
    if (!days || days.includes(weekday(d))) out.push(d);
  }
  return out;
}

const GOOGLE_FIELDS: (keyof Item)[] = ['title', 'notes', 'date', 'endDate', 'start', 'end'];

function makeItem(d: ItemDraft, now: number, id = newId()): Item {
  return {
    id,
    kind: d.kind,
    title: d.title.trim() || 'Sans titre',
    date: d.date,
    endDate: d.endDate && d.endDate > d.date ? d.endDate : undefined,
    start: d.start,
    end: d.start ? d.end : null,
    categoryId: d.categoryId,
    notes: d.notes,
    subtasks: d.subtasks,
    done: d.done ?? false,
    origin: 'app',
    sync: d.sync,
    dirty: d.sync,
    rev: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function createItem(state: AppState, draft: ItemDraft, repeat?: RepeatDraft, now = Date.now()): { state: AppState; id: string } {
  if (!repeat) {
    const it = makeItem(draft, now);
    return { state: { ...state, items: { ...state.items, [it.id]: it } }, id: it.id };
  }
  const series: Series = {
    id: newId(),
    freq: repeat.freq,
    byDay: repeat.byDay,
    startDate: draft.date,
    until: repeat.until < draft.date ? draft.date : repeat.until,
    sync: draft.sync,
    exdates: [],
  };
  const items = { ...state.items };
  let firstId = '';
  for (const date of seriesDates(series)) {
    const it = makeItem({ ...draft, date, endDate: undefined, subtasks: draft.subtasks.map((s) => ({ ...s, id: newId() })) }, now);
    it.seriesId = series.id;
    // Les occurrences d'une série synchronisée sont liées après l'envoi du maître récurrent.
    it.dirty = false;
    items[it.id] = it;
    if (!firstId) firstId = it.id;
  }
  return { state: { ...state, items, series: { ...state.series, [series.id]: series } }, id: firstId };
}

export type Scope = 'one' | 'series';

/** Éléments de la même série que `item` (série de l'app ou récurrence Google). */
export function seriesSiblings(state: AppState, item: Item): Item[] {
  if (item.seriesId) return Object.values(state.items).filter((i) => i.seriesId === item.seriesId);
  if (item.g?.recurringEventId) {
    const rid = item.g.recurringEventId;
    return Object.values(state.items).filter((i) => i.g?.recurringEventId === rid);
  }
  return [item];
}

export function isRecurring(item: Item): boolean {
  return !!item.seriesId || !!item.g?.recurringEventId;
}

function touchesGoogle(item: Item, patch: Partial<Item>): boolean {
  return GOOGLE_FIELDS.some((k) => k in patch && (patch as any)[k] !== (item as any)[k]);
}

function shouldPush(item: Item): boolean {
  if (item.g?.readOnly) return false;
  return !!item.g || (item.origin === 'app' && item.sync);
}

export function updateItem(state: AppState, id: string, patch: Partial<Item>, scope: Scope = 'one', now = Date.now()): AppState {
  const item = state.items[id];
  if (!item) return state;
  const items = { ...state.items };

  if (scope === 'one') {
    const next: Item = { ...item, ...patch, updatedAt: now, rev: item.rev + 1 };
    if (!next.start) next.end = null;
    if (next.endDate && next.endDate <= next.date) delete next.endDate;
    if (touchesGoogle(item, patch) && shouldPush(next)) {
      // Une occurrence de série synchronisée pas encore liée sera envoyée après liaison.
      next.dirty = true;
    }
    items[id] = next;
    return { ...state, items };
  }

  // Toute la série : on applique les champs « hors date » à chaque occurrence.
  const { date: _d, endDate: _e, done: _x, subtasks: _s, ...seriesPatch } = patch;
  const siblings = seriesSiblings(state, item);
  const series = item.seriesId ? state.series[item.seriesId] : undefined;
  const masterId = item.g?.recurringEventId ?? series?.g?.masterId;
  const calendarId = item.g?.calendarId ?? series?.g?.calendarId;
  const viaMaster = !!masterId && !!calendarId && !item.g?.readOnly;

  for (const sib of siblings) {
    const p = sib.id === id ? patch : seriesPatch;
    const next: Item = { ...sib, ...p, updatedAt: now, rev: sib.rev + 1 };
    if (!next.start) next.end = null;
    if (!viaMaster && touchesGoogle(sib, p) && shouldPush(next)) next.dirty = true;
    items[sib.id] = next;
  }
  let google = state.google;
  if (viaMaster && touchesGoogle(item, seriesPatch)) {
    google = {
      ...google,
      masterPatches: [
        ...google.masterPatches,
        {
          calendarId: calendarId!,
          masterId: masterId!,
          title: seriesPatch.title ?? item.title,
          notes: seriesPatch.notes ?? item.notes,
          start: (seriesPatch.start ?? item.start) || undefined,
          end: (seriesPatch.end ?? item.end) || undefined,
        },
      ],
    };
  }
  return { ...state, items, google };
}

export function deleteItem(state: AppState, id: string, scope: Scope = 'one'): AppState {
  const item = state.items[id];
  if (!item) return state;
  const items = { ...state.items };
  let google = state.google;
  let series = state.series;

  if (scope === 'one') {
    delete items[id];
    if (item.g && !item.g.readOnly) {
      google = { ...google, pendingDeletes: [...google.pendingDeletes, { calendarId: item.g.calendarId, eventId: item.g.eventId }] };
    } else if (item.seriesId && series[item.seriesId]) {
      const s = series[item.seriesId];
      series = { ...series, [s.id]: { ...s, exdates: [...s.exdates, item.date] } };
    }
    return { ...state, items, google, series };
  }

  for (const sib of seriesSiblings(state, item)) delete items[sib.id];
  if (item.seriesId && series[item.seriesId]) {
    const s = series[item.seriesId];
    if (s.g) google = { ...google, pendingDeletes: [...google.pendingDeletes, { calendarId: s.g.calendarId, eventId: s.g.masterId }] };
    series = { ...series };
    delete series[item.seriesId];
  } else if (item.g?.recurringEventId && !item.g.readOnly) {
    google = { ...google, pendingDeletes: [...google.pendingDeletes, { calendarId: item.g.calendarId, eventId: item.g.recurringEventId }] };
  }
  return { ...state, items, google, series };
}

/** Active / désactive l'envoi vers Google d'un élément créé dans l'app (et de sa série). */
export function setItemSync(state: AppState, id: string, on: boolean, now = Date.now()): AppState {
  const item = state.items[id];
  if (!item || item.origin !== 'app') return state;
  const items = { ...state.items };
  let google = state.google;
  let series = state.series;
  const s = item.seriesId ? series[item.seriesId] : undefined;
  const targets = s ? seriesSiblings(state, item) : [item];

  if (on) {
    for (const t of targets) items[t.id] = { ...t, sync: true, dirty: !s, rev: t.rev + 1, updatedAt: now };
    if (s) series = { ...series, [s.id]: { ...s, sync: true } };
  } else {
    const dels = [...google.pendingDeletes];
    if (s?.g) dels.push({ calendarId: s.g.calendarId, eventId: s.g.masterId });
    for (const t of targets) {
      if (t.g && !s?.g) dels.push({ calendarId: t.g.calendarId, eventId: t.g.eventId });
      const { g: _g, ...rest } = t;
      items[t.id] = { ...rest, sync: false, dirty: false, rev: t.rev + 1, updatedAt: now };
    }
    google = { ...google, pendingDeletes: dels };
    if (s) {
      const { g: _g, ...rest } = s;
      series = { ...series, [s.id]: { ...rest, sync: false, exdates: [] } };
    }
  }
  return { ...state, items, google, series };
}

// ---------------------------------------------------------------- Catégories

export function upsertCategory(state: AppState, cat: Category): AppState {
  const exists = state.categories.some((c) => c.id === cat.id);
  return {
    ...state,
    categories: exists ? state.categories.map((c) => (c.id === cat.id ? cat : c)) : [...state.categories, cat],
  };
}

export function deleteCategory(state: AppState, id: string): AppState {
  const items = { ...state.items };
  for (const it of Object.values(items)) if (it.categoryId === id) items[it.id] = { ...it, categoryId: null };
  const calendarCategory = { ...state.google.calendarCategory };
  for (const k of Object.keys(calendarCategory)) if (calendarCategory[k] === id) calendarCategory[k] = null;
  return {
    ...state,
    items,
    categories: state.categories.filter((c) => c.id !== id),
    google: { ...state.google, calendarCategory },
  };
}

// ---------------------------------------------------------------- Habitudes

export function toggleHabit(state: AppState, date: ISODate, habitId: string, value?: boolean): AppState {
  const day = { ...(state.habitLog[date] ?? {}) };
  const next = value ?? !day[habitId];
  if (next) day[habitId] = true;
  else delete day[habitId];
  return { ...state, habitLog: { ...state.habitLog, [date]: day } };
}

export function upsertHabit(state: AppState, h: Habit): AppState {
  const exists = state.habits.some((x) => x.id === h.id);
  return { ...state, habits: exists ? state.habits.map((x) => (x.id === h.id ? h : x)) : [...state.habits, h] };
}

export function deleteHabit(state: AppState, id: string): AppState {
  return { ...state, habits: state.habits.filter((h) => h.id !== id) };
}

export function challengeLength(state: AppState): number {
  return diffDays(state.challenge.endDate, state.challenge.startDate) + 1;
}
