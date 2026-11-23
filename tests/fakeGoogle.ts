// Faux Google Agenda en mémoire, fidèle aux comportements utilisés par la synchro :
// IDs fournis par le client (409 si déjà pris), récurrences DAILY/WEEKLY développées
// avec singleEvents, exceptions d'occurrence, etags, suppression (status cancelled).
import { ApiError, type CalendarApi } from '../src/lib/google/api';
import type { GEvent } from '../src/lib/google/mapping';
import { addDays, fromParis, toParis, weekday } from '../src/lib/dates';
import type { GoogleCalendarInfo } from '../src/lib/types';

interface Stored extends GEvent {
  cancelledInstances?: Set<string>;
  overrides?: Map<string, GEvent>;
}

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export class FakeGoogle implements CalendarApi {
  calendars: GoogleCalendarInfo[] = [
    { id: 'primary@x', summary: 'Moi', color: '#039be5', accessRole: 'owner', primary: true },
    { id: 'feries', summary: 'Jours fériés', color: '#0b8043', accessRole: 'reader' },
  ];
  store = new Map<string, Map<string, Stored>>();
  clock = Date.parse('2026-11-20T10:00:00Z');
  etagN = 0;
  calls: string[] = [];

  cal(id: string) {
    if (!this.store.has(id)) this.store.set(id, new Map());
    return this.store.get(id)!;
  }

  private stamp(ev: GEvent) {
    this.clock += 1000;
    ev.etag = `"e${++this.etagN}"`;
    ev.updated = new Date(this.clock).toISOString();
  }

  /** Normalise un horaire « mural + fuseau » en RFC3339 UTC, comme le renvoie Google. */
  private norm(t?: { date?: string; dateTime?: string; timeZone?: string }) {
    if (!t) return t;
    if (t.date) return { date: t.date };
    if (t.dateTime && !/[zZ]|[+-]\d\d:\d\d$/.test(t.dateTime)) {
      const [d, time] = t.dateTime.split('T');
      return { dateTime: new Date(fromParis(d, time.slice(0, 5))).toISOString(), timeZone: t.timeZone };
    }
    return { ...t };
  }

  /** Ajoute directement un événement « côté Google » (comme depuis l'app Google). */
  seed(calendarId: string, ev: Partial<GEvent> & { id: string }) {
    const e: Stored = { status: 'confirmed', ...ev, start: this.norm(ev.start), end: this.norm(ev.end) } as Stored;
    this.stamp(e);
    this.cal(calendarId).set(e.id, e);
    return e;
  }

  edit(calendarId: string, id: string, patch: Partial<GEvent>) {
    const e = this.cal(calendarId).get(id)!;
    Object.assign(e, patch, { start: this.norm(patch.start ?? e.start), end: this.norm(patch.end ?? e.end) });
    this.stamp(e);
  }

  remove(calendarId: string, id: string) {
    const e = this.cal(calendarId).get(id)!;
    e.status = 'cancelled';
    this.stamp(e);
  }

  async listCalendars() {
    this.calls.push('calendarList');
    return this.calendars;
  }

  private expand(m: Stored): GEvent[] {
    const rule = (m.recurrence ?? [])[0];
    if (!rule) return [m];
    const parts = Object.fromEntries(rule.replace('RRULE:', '').split(';').map((p) => p.split('=')));
    const allDay = !!m.start!.date;
    const first = allDay ? m.start!.date! : toParis(Date.parse(m.start!.dateTime!));
    const startDate = typeof first === 'string' ? first : first.date;
    const untilRaw: string = parts.UNTIL;
    const until = `${untilRaw.slice(0, 4)}-${untilRaw.slice(4, 6)}-${untilRaw.slice(6, 8)}`;
    const days = parts.BYDAY ? parts.BYDAY.split(',').map((d: string) => BYDAY.indexOf(d)) : null;
    const durMs = allDay ? 0 : Date.parse(m.end!.dateTime!) - Date.parse(m.start!.dateTime!);
    const time = allDay ? '' : (first as { time: string }).time;
    const out: GEvent[] = [];
    for (let d = startDate; d <= until; d = addDays(d, 1)) {
      if (parts.FREQ === 'WEEKLY' && days && !days.includes(weekday(d))) continue;
      const startMs = allDay ? 0 : fromParis(d, time);
      const key = allDay ? d.replace(/-/g, '') : new Date(startMs).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const iid = `${m.id}_${key}`;
      if (m.cancelledInstances?.has(iid)) continue;
      const orig = allDay ? { date: d } : { dateTime: new Date(startMs).toISOString() };
      const base: GEvent = {
        id: iid,
        status: 'confirmed',
        summary: m.summary,
        description: m.description,
        etag: m.etag,
        updated: m.updated,
        recurringEventId: m.id,
        originalStartTime: orig,
        extendedProperties: m.extendedProperties,
        start: allDay ? { date: d } : { dateTime: new Date(startMs).toISOString() },
        end: allDay ? { date: addDays(d, 1) } : { dateTime: new Date(startMs + durMs).toISOString() },
      };
      const ov = m.overrides?.get(iid);
      out.push(ov ? { ...base, ...ov, id: iid, recurringEventId: m.id, originalStartTime: orig } : base);
    }
    return out;
  }

  async listEvents(calendarId: string, timeMin: string, timeMax: string) {
    this.calls.push(`list ${calendarId}`);
    const a = Date.parse(timeMin);
    const b = Date.parse(timeMax);
    const out: GEvent[] = [];
    for (const e of this.cal(calendarId).values()) {
      if (e.status === 'cancelled') continue;
      for (const inst of this.expand(e)) {
        const s = inst.start!.date ? fromParis(inst.start!.date, '00:00') : Date.parse(inst.start!.dateTime!);
        const en = inst.end!.date ? fromParis(inst.end!.date, '00:00') : Date.parse(inst.end!.dateTime!);
        if (en > a && s < b) out.push(JSON.parse(JSON.stringify(inst)));
      }
    }
    return out;
  }

  private findInstance(calendarId: string, id: string): { master: Stored; inst: GEvent } | null {
    const i = id.lastIndexOf('_');
    if (i < 0) return null;
    const master = this.cal(calendarId).get(id.slice(0, i));
    if (!master) return null;
    const inst = this.expand(master).find((x) => x.id === id);
    return inst ? { master, inst } : null;
  }

  async getEvent(calendarId: string, id: string) {
    this.calls.push(`get ${id}`);
    const e = this.cal(calendarId).get(id);
    if (e) return JSON.parse(JSON.stringify({ ...e, cancelledInstances: undefined, overrides: undefined }));
    const f = this.findInstance(calendarId, id);
    return f ? f.inst : null;
  }

  async insertEvent(calendarId: string, body: Partial<GEvent>) {
    this.calls.push(`insert ${body.id ?? '(auto)'}`);
    const id = body.id ?? `auto${++this.etagN}x`;
    if (this.cal(calendarId).has(id)) throw new ApiError(409, 'The requested identifier already exists.');
    const e: Stored = { ...(body as GEvent), id, status: 'confirmed', start: this.norm(body.start), end: this.norm(body.end) };
    this.stamp(e);
    this.cal(calendarId).set(id, e);
    return JSON.parse(JSON.stringify(e));
  }

  async patchEvent(calendarId: string, id: string, body: Partial<GEvent>) {
    this.calls.push(`patch ${id}`);
    const e = this.cal(calendarId).get(id);
    if (e) {
      if (e.status === 'cancelled') throw new ApiError(410, 'Deleted');
      Object.assign(e, body, { start: this.norm(body.start ?? e.start), end: this.norm(body.end ?? e.end) });
      this.stamp(e);
      return JSON.parse(JSON.stringify({ ...e, cancelledInstances: undefined, overrides: undefined }));
    }
    const f = this.findInstance(calendarId, id);
    if (!f) throw new ApiError(404, 'Not Found');
    f.master.overrides ??= new Map();
    const prev = f.master.overrides.get(id) ?? {};
    const ov: GEvent = { ...prev, ...body, id, start: this.norm(body.start ?? f.inst.start), end: this.norm(body.end ?? f.inst.end) } as GEvent;
    this.stamp(ov);
    f.master.overrides.set(id, ov);
    return { ...f.inst, ...ov };
  }

  async deleteEvent(calendarId: string, id: string) {
    this.calls.push(`delete ${id}`);
    const e = this.cal(calendarId).get(id);
    if (e) {
      e.status = 'cancelled';
      this.stamp(e);
      return;
    }
    const f = this.findInstance(calendarId, id);
    if (!f) return;
    f.master.cancelledInstances ??= new Set();
    f.master.cancelledInstances.add(id);
    this.stamp(f.master);
  }

  /** Événements « visibles » (non annulés), hors développement des récurrences. */
  live(calendarId = 'primary@x') {
    return [...this.cal(calendarId).values()].filter((e) => e.status !== 'cancelled');
  }
}
