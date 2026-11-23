// Accès à l'API Google Calendar v3 avec un jeton d'accès obtenu auprès de notre serveur.
import type { GoogleCalendarInfo } from '../types';
import type { GEvent } from './mapping';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class AuthError extends Error {}

export interface CalendarApi {
  listCalendars(): Promise<GoogleCalendarInfo[]>;
  listEvents(calendarId: string, timeMin: string, timeMax: string): Promise<GEvent[]>;
  getEvent(calendarId: string, eventId: string): Promise<GEvent | null>;
  insertEvent(calendarId: string, body: Partial<GEvent>): Promise<GEvent>;
  patchEvent(calendarId: string, eventId: string, body: Partial<GEvent>): Promise<GEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}

const BASE = 'https://www.googleapis.com/calendar/v3';
const enc = encodeURIComponent;

export async function serverJSON<T>(path: string, init: RequestInit = {}, session?: string): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { 'X-Givre-Session': session } : {}),
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new AuthError(data.error || 'Session Google expirée');
  if (!res.ok) throw new ApiError(res.status, data.error || `Erreur serveur ${res.status}`);
  return data as T;
}

export function createHttpApi(getSession: () => string | undefined): CalendarApi {
  let token: { value: string; exp: number } | null = null;

  async function accessToken(force = false): Promise<string> {
    if (!force && token && token.exp > Date.now() + 60_000) return token.value;
    const session = getSession();
    if (!session) throw new AuthError('Compte Google non connecté');
    const r = await serverJSON<{ access_token: string; expires_in: number }>('/api/google/token', { method: 'POST', body: '{}' }, session);
    token = { value: r.access_token, exp: Date.now() + r.expires_in * 1000 };
    return token.value;
  }

  async function call<T>(method: string, url: string, body?: unknown, retry = true): Promise<T> {
    const t = await accessToken();
    const res = await fetch(BASE + url, {
      method,
      headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && retry) {
      await accessToken(true);
      return call<T>(method, url, body, false);
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data?.error?.message || `Google Agenda : erreur ${res.status}`);
    return data as T;
  }

  return {
    async listCalendars() {
      const out: GoogleCalendarInfo[] = [];
      let pageToken = '';
      do {
        const r = await call<any>('GET', `/users/me/calendarList?maxResults=250${pageToken ? `&pageToken=${enc(pageToken)}` : ''}`);
        for (const c of r.items ?? []) {
          out.push({
            id: c.id,
            summary: c.summaryOverride || c.summary || c.id,
            color: c.backgroundColor || '#7d8597',
            accessRole: c.accessRole,
            primary: !!c.primary,
          });
        }
        pageToken = r.nextPageToken ?? '';
      } while (pageToken);
      return out;
    },
    async listEvents(calendarId, timeMin, timeMax) {
      const out: GEvent[] = [];
      let pageToken = '';
      do {
        const q = `singleEvents=true&showDeleted=false&maxResults=2500&timeMin=${enc(timeMin)}&timeMax=${enc(timeMax)}&timeZone=Europe%2FParis${pageToken ? `&pageToken=${enc(pageToken)}` : ''}`;
        const r = await call<any>('GET', `/calendars/${enc(calendarId)}/events?${q}`);
        out.push(...(r.items ?? []));
        pageToken = r.nextPageToken ?? '';
      } while (pageToken);
      return out;
    },
    async getEvent(calendarId, eventId) {
      try {
        return await call<GEvent>('GET', `/calendars/${enc(calendarId)}/events/${enc(eventId)}`);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 410)) return null;
        throw e;
      }
    },
    insertEvent(calendarId, body) {
      return call<GEvent>('POST', `/calendars/${enc(calendarId)}/events`, body);
    },
    patchEvent(calendarId, eventId, body) {
      return call<GEvent>('PATCH', `/calendars/${enc(calendarId)}/events/${enc(eventId)}`, body);
    },
    async deleteEvent(calendarId, eventId) {
      try {
        await call<void>('DELETE', `/calendars/${enc(calendarId)}/events/${enc(eventId)}`);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 410)) return;
        throw e;
      }
    },
  };
}
