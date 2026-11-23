// Moteur de synchronisation bidirectionnelle avec Google Agenda.
//
// Ordre d'une synchronisation :
//  1. liste des agendas ;
//  2. suppressions locales en attente → Google ;
//  3. modifications de séries entières (événement maître) → Google ;
//  4. envoi des nouvelles séries récurrentes créées dans l'app ;
//  5. lecture des événements Google (fenêtre glissante) et rapprochement ;
//  6. envoi des créations / modifications locales.
//
// Doublons évités : l'ID Google d'un élément créé dans l'app est son propre ID
// (insertion idempotente), et l'ID local est aussi stocké dans une propriété privée.
import { addDays, fromParis, minDate, maxDate, startOfWeek, todayParis, toParis } from '../dates';
import { seriesDates } from '../actions';
import type { AppState, Item, ISODate, Series } from '../types';
import { ApiError, AuthError, type CalendarApi } from './api';
import { dayStartRFC, eventBody, googleTimes, originalDate, timeFieldsFromGoogle, type GEvent } from './mapping';

export interface SyncStore {
  get(): AppState;
  set(fn: (s: AppState) => AppState): void;
}

export interface SyncOptions {
  now?: number;
  /** Date affichée : la fenêtre de synchronisation l'inclut toujours. */
  focus?: ISODate;
  pastDays?: number;
  futureDays?: number;
}

export interface SyncReport {
  pulled: number;
  created: number;
  updated: number;
  deletedLocal: number;
  pushed: number;
  deletedRemote: number;
}

export const PAST_DAYS = 60;
export const FUTURE_DAYS = 240;

export function syncWindow(opts: SyncOptions = {}): { from: ISODate; to: ISODate } {
  const today = todayParis(opts.now);
  let from = addDays(today, -(opts.pastDays ?? PAST_DAYS));
  let to = addDays(today, opts.futureDays ?? FUTURE_DAYS);
  if (opts.focus) {
    const ws = startOfWeek(opts.focus);
    from = minDate(from, ws);
    to = maxDate(to, addDays(ws, 7));
  }
  return { from, to };
}

const isGone = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 410);

function rrule(s: Series, hasTime: boolean, startTime: string | null): string {
  const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  let rule = 'RRULE:';
  if (s.freq === 'daily') rule += 'FREQ=DAILY';
  else if (s.freq === 'weekdays') rule += 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
  else rule += `FREQ=WEEKLY;BYDAY=${(s.byDay?.length ? s.byDay : [0]).map((d) => days[d]).join(',')}`;
  const compact = (d: string) => d.replace(/-/g, '');
  if (hasTime && startTime) {
    // UNTIL en UTC : fin de la dernière journée à Paris.
    const until = new Date(fromParis(s.until, '23:59')).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    rule += `;UNTIL=${until}`;
  } else rule += `;UNTIL=${compact(s.until)}`;
  return rule;
}

function applyRemote(it: Item, ev: GEvent, calendarId: string, readOnly: boolean): Item {
  const tf = timeFieldsFromGoogle(ev);
  return {
    ...it,
    title: ev.summary || '(Sans titre)',
    notes: ev.description ?? '',
    ...(tf ?? {}),
    endDate: tf?.endDate,
    dirty: false,
    g: linkOf(ev, calendarId, readOnly),
  };
}

function linkOf(ev: GEvent, calendarId: string, readOnly: boolean): Item['g'] {
  return {
    calendarId,
    eventId: ev.id,
    etag: ev.etag,
    updated: ev.updated,
    recurringEventId: ev.recurringEventId,
    readOnly: readOnly || undefined,
    htmlLink: ev.htmlLink,
  };
}

let running: Promise<SyncReport> | null = null;

/** Lance une synchronisation (une seule à la fois). */
export function sync(api: CalendarApi, store: SyncStore, opts: SyncOptions = {}): Promise<SyncReport> {
  if (running) return running;
  running = doSync(api, store, opts).finally(() => {
    running = null;
  });
  return running;
}

async function doSync(api: CalendarApi, store: SyncStore, opts: SyncOptions): Promise<SyncReport> {
  const report: SyncReport = { pulled: 0, created: 0, updated: 0, deletedLocal: 0, pushed: 0, deletedRemote: 0 };
  const now = () => opts.now ?? Date.now();
  try {
    // 1. Agendas
    const cals = await api.listCalendars();
    store.set((s) => {
      const ids = new Set(cals.map((c) => c.id));
      let selected = s.google.selected.filter((id) => ids.has(id));
      let target = s.google.targetCalendarId;
      const primary = cals.find((c) => c.primary) ?? cals[0];
      if (!s.google.calendars.length && !selected.length && primary) selected = [primary.id];
      if ((!target || !ids.has(target)) && primary) target = primary.id;
      if (target && !selected.includes(target)) selected = [...selected, target];
      return { ...s, google: { ...s.google, calendars: cals, selected, targetCalendarId: target } };
    });
    const roleOf = (id: string) => cals.find((c) => c.id === id)?.accessRole;
    const readOnlyCal = (id: string) => {
      const r = roleOf(id);
      return r === 'reader' || r === 'freeBusyReader';
    };

    // 2. Suppressions en attente
    for (const del of [...store.get().google.pendingDeletes]) {
      await api.deleteEvent(del.calendarId, del.eventId);
      report.deletedRemote++;
      store.set((s) => ({
        ...s,
        google: { ...s.google, pendingDeletes: s.google.pendingDeletes.filter((d) => !(d.calendarId === del.calendarId && d.eventId === del.eventId)) },
      }));
    }

    // 3. Modifications de séries entières
    for (const mp of [...store.get().google.masterPatches]) {
      const master = await api.getEvent(mp.calendarId, mp.masterId);
      if (master && master.status !== 'cancelled') {
        const body: Partial<GEvent> = {};
        if (mp.title !== undefined) body.summary = mp.title;
        if (mp.notes !== undefined) body.description = mp.notes;
        if (mp.start && mp.end && master.start?.dateTime) {
          const d = toParis(Date.parse(master.start.dateTime)).date;
          Object.assign(body, googleTimes({ date: d, start: mp.start, end: mp.end }));
        }
        await api.patchEvent(mp.calendarId, mp.masterId, body);
      }
      store.set((s) => ({ ...s, google: { ...s.google, masterPatches: s.google.masterPatches.filter((x) => x !== mp) } }));
    }

    // 4. Nouvelles séries récurrentes à envoyer
    const target = store.get().google.targetCalendarId;
    for (const s of Object.values(store.get().series)) {
      if (!s.sync || s.g || !target) continue;
      const occ = Object.values(store.get().items).filter((i) => i.seriesId === s.id).sort((a, b) => a.date.localeCompare(b.date));
      if (!occ.length) {
        store.set((st) => {
          const series = { ...st.series };
          delete series[s.id];
          return { ...st, series };
        });
        continue;
      }
      const tpl = occ[0];
      const first = seriesDates(s, 1)[0] ?? tpl.date;
      const body: Partial<GEvent> = {
        ...eventBody({ ...tpl, date: first, endDate: undefined }),
        id: s.id,
        recurrence: [rrule(s, !!tpl.start, tpl.start)],
      };
      body.extendedProperties = { private: { givreSeries: s.id } };
      if (tpl.start) {
        body.start = { ...body.start!, timeZone: 'Europe/Paris' };
        body.end = { ...body.end!, timeZone: 'Europe/Paris' };
      }
      let master: GEvent;
      try {
        master = await api.insertEvent(target, body);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 409)) throw e;
        const existing = await api.getEvent(target, s.id);
        if (existing && existing.status !== 'cancelled') master = existing;
        else {
          const { id: _id, ...rest } = body;
          master = await api.insertEvent(target, rest);
        }
      }
      store.set((st) => ({
        ...st,
        series: { ...st.series, [s.id]: { ...st.series[s.id], g: { calendarId: target, masterId: master.id } } },
      }));
      report.pushed++;
    }

    // 5. Lecture des agendas sélectionnés
    const win = syncWindow(opts);
    const timeMin = dayStartRFC(win.from);
    const timeMax = dayStartRFC(win.to);
    for (const calId of [...store.get().google.selected]) {
      const events = (await api.listEvents(calId, timeMin, timeMax)).filter((e) => e.status !== 'cancelled');
      report.pulled += events.length;
      const ro = readOnlyCal(calId);
      const toDeleteRemote: string[] = [];

      store.set((s) => {
        const items = { ...s.items };
        const byEvent = new Map<string, Item>();
        const byGivre = new Map<string, Item>();
        const recurringCat = new Map<string, string | null>();
        for (const it of Object.values(items)) {
          if (it.g?.calendarId === calId) byEvent.set(it.g.eventId, it);
          if (!it.g) byGivre.set(it.id, it);
          if (it.g?.recurringEventId) recurringCat.set(it.g.recurringEventId, it.categoryId);
        }
        const seriesByMaster = new Map<string, Series>();
        for (const se of Object.values(s.series)) if (se.g?.calendarId === calId) seriesByMaster.set(se.g.masterId, se);
        const seen = new Set<string>();

        for (const ev of events) {
          seen.add(ev.id);
          let local = byEvent.get(ev.id);
          if (!local && !ev.recurringEventId) {
            const gid = ev.extendedProperties?.private?.givreId;
            local = (gid && byGivre.get(gid)) || byGivre.get(ev.id);
          }
          const appSeries = ev.recurringEventId ? seriesByMaster.get(ev.recurringEventId) : undefined;
          if (!local && appSeries) {
            const od = originalDate(ev);
            local = Object.values(items).find((i) => i.seriesId === appSeries.id && !i.g && i.date === od);
            if (!local && od && appSeries.exdates.includes(od)) {
              toDeleteRemote.push(ev.id);
              continue;
            }
          }

          if (local) {
            const cur = items[local.id];
            if (cur.g?.etag && cur.g.etag === ev.etag && cur.g.eventId === ev.id) continue;
            const remoteUpdated = ev.updated ? Date.parse(ev.updated) : 0;
            if (cur.dirty && (cur.updatedAt >= remoteUpdated || !cur.g)) {
              // Modification locale plus récente : on la garde, elle sera envoyée à l'étape 6.
              items[cur.id] = { ...cur, g: linkOf(ev, calId, ro) };
            } else {
              items[cur.id] = applyRemote(cur, ev, calId, ro);
              report.updated++;
            }
            continue;
          }

          // Nouvel événement Google
          const tf = timeFieldsFromGoogle(ev);
          if (!tf) continue;
          const id = `g${ev.id}`.slice(0, 200);
          const t = now();
          const categoryId = ev.recurringEventId && recurringCat.has(ev.recurringEventId)
            ? recurringCat.get(ev.recurringEventId)!
            : s.google.calendarCategory[calId] ?? null;
          items[id] = {
            id,
            kind: 'event',
            title: ev.summary || '(Sans titre)',
            ...tf,
            categoryId,
            notes: ev.description ?? '',
            subtasks: [],
            done: false,
            origin: appSeries ? 'app' : 'google',
            sync: true,
            seriesId: appSeries?.id,
            g: linkOf(ev, calId, ro),
            rev: 1,
            createdAt: t,
            updatedAt: t,
          };
          report.created++;
        }

        // Supprimés côté Google (absents de la fenêtre lue)
        for (const it of Object.values(items)) {
          if (it.g?.calendarId !== calId || seen.has(it.g.eventId)) continue;
          if (it.date < win.from || it.date >= win.to) continue;
          delete items[it.id];
          report.deletedLocal++;
        }
        return { ...s, items };
      });

      for (const evId of toDeleteRemote) {
        await api.deleteEvent(calId, evId);
        report.deletedRemote++;
      }
    }

    // 6. Envoi des créations / modifications locales
    const tgt = store.get().google.targetCalendarId;
    const dirty = Object.values(store.get().items).filter((i) => i.dirty);
    for (const snap of dirty) {
      const it = store.get().items[snap.id];
      if (!it || !it.dirty) continue;
      if (it.g?.readOnly) {
        store.set((s) => ({ ...s, items: { ...s.items, [it.id]: { ...it, dirty: false } } }));
        continue;
      }
      if (!it.g && !(it.origin === 'app' && it.sync)) continue;
      const se = it.seriesId ? store.get().series[it.seriesId] : undefined;
      if (!it.g && se?.sync) continue; // attend la liaison avec l'occurrence Google
      const rev = it.rev;
      let ev: GEvent | null = null;
      let calId = it.g?.calendarId ?? tgt;
      if (!calId) continue;
      try {
        if (it.g) {
          const body = eventBody(it);
          if (it.g.recurringEventId) delete body.extendedProperties;
          ev = await api.patchEvent(it.g.calendarId, it.g.eventId, body);
        } else {
          try {
            ev = await api.insertEvent(calId, { ...eventBody(it), id: it.id });
          } catch (e) {
            if (!(e instanceof ApiError && e.status === 409)) throw e;
            const existing = await api.getEvent(calId, it.id);
            if (existing && existing.status !== 'cancelled') ev = await api.patchEvent(calId, it.id, eventBody(it));
            else ev = await api.insertEvent(calId, eventBody(it));
          }
        }
      } catch (e) {
        if (!isGone(e) || !it.g) throw e;
        // Événement supprimé dans Google entre-temps
        store.set((s) => {
          const items = { ...s.items };
          if (it.origin === 'google' || it.g?.recurringEventId) delete items[it.id];
          else {
            const { g: _g, ...rest } = items[it.id];
            items[it.id] = { ...rest, dirty: true };
          }
          return { ...s, items };
        });
        continue;
      }
      const result = ev!;
      const ro = readOnlyCal(calId);
      store.set((s) => {
        const cur = s.items[it.id];
        if (!cur) return s;
        return {
          ...s,
          items: { ...s.items, [it.id]: { ...cur, g: linkOf(result, calId!, ro), dirty: cur.rev === rev ? false : cur.dirty } },
        };
      });
      report.pushed++;
    }

    store.set((s) => ({ ...s, google: { ...s.google, lastSyncAt: now(), lastError: undefined, authError: false } }));
    return report;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    store.set((s) => ({
      ...s,
      google: { ...s.google, lastError: msg, authError: e instanceof AuthError ? true : s.google.authError },
    }));
    throw e;
  }
}

/** Supprime les événements importés d'un agenda qui n'est plus synchronisé. */
export function forgetCalendar(s: AppState, calendarId: string): AppState {
  const items = { ...s.items };
  for (const it of Object.values(items)) {
    if (it.g?.calendarId !== calendarId) continue;
    if (it.origin === 'google') delete items[it.id];
    else {
      // Élément créé dans l'app : on le garde, il sera renvoyé à la prochaine connexion.
      const { g: _g, ...rest } = it;
      items[it.id] = { ...rest, dirty: it.sync && !it.seriesId };
    }
  }
  return { ...s, items };
}

/** Déconnexion : retire les événements Google, garde les éléments de l'app. */
export function forgetGoogle(s: AppState): AppState {
  let next = s;
  for (const c of new Set(Object.values(s.items).map((i) => i.g?.calendarId).filter(Boolean) as string[])) next = forgetCalendar(next, c);
  const series = { ...next.series };
  for (const k of Object.keys(series)) {
    const { g: _g, ...rest } = series[k];
    series[k] = { ...rest, exdates: [] };
  }
  return {
    ...next,
    series,
    google: {
      ...next.google,
      session: undefined,
      email: undefined,
      connectedAt: undefined,
      calendars: [],
      selected: [],
      lastSyncAt: undefined,
      lastError: undefined,
      authError: false,
      pendingDeletes: [],
      masterPatches: [],
    },
  };
}
