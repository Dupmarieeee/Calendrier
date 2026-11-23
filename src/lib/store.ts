// Petit magasin d'état global, persistant dans le stockage local de l'iPhone.
import { useSyncExternalStore } from 'react';
import { defaultState } from './actions';
import type { AppState } from './types';

export const STORAGE_KEY = 'givre:v1';

type Listener = () => void;

export interface Store {
  get(): AppState;
  set(fn: (s: AppState) => AppState): void;
  subscribe(l: Listener): () => void;
}

export function createStore(initial: AppState, persist?: (s: AppState) => void): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(fn) {
      const next = fn(state);
      if (next === state) return;
      state = next;
      persist?.(state);
      listeners.forEach((l) => l());
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

/** Fusionne des données sauvegardées avec l'état par défaut (nouveaux champs). */
export function hydrate(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState>;
  return {
    ...base,
    ...r,
    version: 1,
    categories: Array.isArray(r.categories) ? r.categories : base.categories,
    items: r.items ?? {},
    series: r.series ?? {},
    challenge: { ...base.challenge, ...(r.challenge ?? {}) },
    habits: Array.isArray(r.habits) ? r.habits : base.habits,
    habitLog: r.habitLog ?? {},
    google: { ...base.google, ...(r.google ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
  };
}

function load(): AppState {
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    if (txt) return hydrate(JSON.parse(txt));
  } catch {
    /* stockage indisponible : on repart d'un état neuf */
  }
  return defaultState();
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pending: AppState | undefined;

function flush() {
  if (!pending) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    /* quota dépassé ou navigation privée */
  }
  pending = undefined;
}

function persist(s: AppState) {
  pending = s;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

export const store: Store = createStore(typeof window === 'undefined' ? defaultState() : load(), persist);

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  // Demande au navigateur de ne pas effacer les données (Safari ≥ 15.2).
  navigator.storage?.persist?.().catch(() => {});
}

export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(store.get()));
}

export const update = (fn: (s: AppState) => AppState) => store.set(fn);
