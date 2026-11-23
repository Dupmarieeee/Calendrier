// Connexion au compte Google et planification des synchronisations.
import { useSyncExternalStore } from 'react';
import { store } from '../store';
import { createHttpApi, serverJSON } from './api';
import { forgetCalendar, forgetGoogle, sync, syncWindow, type SyncReport } from './sync';
import type { ISODate } from '../types';

export const api = createHttpApi(() => store.get().google.session);

// ------------------------------------------------------------ État volatil
export interface Runtime {
  configured: boolean | null; // null = inconnu (serveur injoignable)
  syncing: boolean;
  connecting: boolean;
  connectError?: string;
  lastReport?: SyncReport;
}
let rt: Runtime = { configured: null, syncing: false, connecting: false };
const listeners = new Set<() => void>();
function setRt(p: Partial<Runtime>) {
  rt = { ...rt, ...p };
  listeners.forEach((l) => l());
}
export function useGoogleRuntime(): Runtime {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => rt,
  );
}

export async function loadConfig() {
  try {
    const r = await serverJSON<{ googleConfigured: boolean }>('/api/config');
    setRt({ configured: r.googleConfigured });
  } catch {
    setRt({ configured: null });
  }
}

// ------------------------------------------------------------ Connexion OAuth
const LOGIN_KEY = 'givre:login';

function randomId() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let pollTimer: ReturnType<typeof setTimeout> | undefined;

/** À appeler directement dans le gestionnaire du toucher (ouverture de fenêtre). */
export function connectGoogle() {
  const id = randomId();
  localStorage.setItem(LOGIN_KEY, JSON.stringify({ id, at: Date.now() }));
  const url = `/api/google/auth/begin?id=${encodeURIComponent(id)}`;
  const w = window.open(url, '_blank');
  if (!w) {
    window.location.href = url;
    return;
  }
  setRt({ connecting: true, connectError: undefined });
  poll(id);
}

export function cancelConnect() {
  clearTimeout(pollTimer);
  localStorage.removeItem(LOGIN_KEY);
  setRt({ connecting: false });
}

async function claim(id: string): Promise<'done' | 'pending' | 'error'> {
  const res = await fetch('/api/google/auth/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: id }),
  });
  if (res.status === 202) return 'pending';
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    localStorage.removeItem(LOGIN_KEY);
    setRt({ connecting: false, connectError: data.error || 'La connexion a échoué.' });
    return 'error';
  }
  localStorage.removeItem(LOGIN_KEY);
  store.set((s) => ({
    ...s,
    google: { ...s.google, session: data.session, email: data.email, connectedAt: Date.now(), authError: false, lastError: undefined },
  }));
  setRt({ connecting: false, connectError: undefined });
  requestSync(0);
  return 'done';
}

function poll(id: string, started = Date.now()) {
  clearTimeout(pollTimer);
  if (Date.now() - started > 10 * 60_000) {
    cancelConnect();
    setRt({ connectError: 'Délai dépassé. Relancez la connexion.' });
    return;
  }
  pollTimer = setTimeout(async () => {
    try {
      if ((await claim(id)) === 'pending') poll(id, started);
    } catch {
      poll(id, started);
    }
  }, 2000);
}

/** Reprend une connexion en cours (retour depuis la page Google, ou app relancée). */
export function resumeConnect() {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('gcal');
  if (fromUrl) {
    url.searchParams.delete('gcal');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    setRt({ connecting: true });
    claim(fromUrl).then((r) => r === 'pending' && poll(fromUrl)).catch(() => poll(fromUrl));
    return;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(LOGIN_KEY) || 'null');
    if (saved && Date.now() - saved.at < 10 * 60_000) {
      setRt({ connecting: true });
      poll(saved.id, saved.at);
    }
  } catch { /* rien */ }
}

export async function disconnectGoogle() {
  const session = store.get().google.session;
  if (session) {
    await fetch('/api/google/disconnect', { method: 'POST', headers: { 'X-Givre-Session': session } }).catch(() => {});
  }
  store.set(forgetGoogle);
}

export function setCalendarSelected(id: string, on: boolean) {
  store.set((s) => {
    const selected = on ? [...new Set([...s.google.selected, id])] : s.google.selected.filter((x) => x !== id);
    const next = { ...s, google: { ...s.google, selected } };
    return on ? next : forgetCalendar(next, id);
  });
  requestSync(300);
}

// ------------------------------------------------------------ Planification
let focus: ISODate | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

export function isConnected() {
  const g = store.get().google;
  return !!g.session && !g.authError;
}

export async function syncNow(): Promise<void> {
  if (!store.get().google.session) return;
  setRt({ syncing: true });
  let ok = false;
  try {
    const report = await sync(api, store, { focus });
    setRt({ lastReport: report });
    ok = true;
  } catch {
    /* l'erreur est enregistrée dans l'état (lastError) */
  } finally {
    setRt({ syncing: false });
  }
  // Modifications faites pendant la synchronisation : on relance.
  if (ok && needsPush()) requestSync(1500);
}

function needsPush(): boolean {
  const s = store.get();
  return !!(s.google.pendingDeletes.length || s.google.masterPatches.length
    || Object.values(s.series).some((x) => x.sync && !x.g)
    || Object.values(s.items).some((i) => i.dirty && !(i.seriesId && !i.g && s.series[i.seriesId]?.sync)));
}

export function requestSync(delay = 1500) {
  if (!isConnected()) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export function setSyncFocus(d: ISODate) {
  const prev = focus;
  focus = d;
  if (!prev) return;
  const w = syncWindow();
  if (d < w.from || d >= w.to) requestSync(300);
}

let started = false;
export function startGoogle() {
  if (started) return;
  started = true;
  loadConfig();
  resumeConnect();
  requestSync(500);
  setInterval(() => document.visibilityState === 'visible' && requestSync(0), 5 * 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestSync(200);
  });
  window.addEventListener('online', () => requestSync(200));
  // Modifications locales → envoi rapide
  let prevItems = store.get().items;
  let prevG = store.get().google;
  store.subscribe(() => {
    const s = store.get();
    if (s.items === prevItems && s.google.pendingDeletes === prevG.pendingDeletes && s.google.masterPatches === prevG.masterPatches) return;
    prevItems = s.items;
    prevG = s.google;
    if (rt.syncing) return;
    if (needsPush()) requestSync(1500);
  });
}
