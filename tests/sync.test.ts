import { beforeEach, describe, expect, it } from 'vitest';
import { createItem, defaultState, deleteItem, setItemSync, updateItem, type ItemDraft } from '../src/lib/actions';
import { createStore, type Store } from '../src/lib/store';
import { sync } from '../src/lib/google/sync';
import type { Item } from '../src/lib/types';
import { FakeGoogle } from './fakeGoogle';

const NOW = Date.parse('2026-11-23T08:00:00Z'); // lundi 23 novembre 2026, 9 h à Paris

function draft(p: Partial<ItemDraft> = {}): ItemDraft {
  return {
    kind: 'event', title: 'Réunion', date: '2026-11-24', start: '09:00', end: '10:30',
    categoryId: 'cat-travail', notes: '', subtasks: [], sync: true, ...p,
  };
}

let g: FakeGoogle;
let store: Store;
const items = () => Object.values(store.get().items);
const run = () => sync(g, store, { now: NOW });

beforeEach(() => {
  g = new FakeGoogle();
  const s = defaultState(NOW);
  s.google.session = 'test';
  store = createStore(s);
});

describe('envoi vers Google', () => {
  it('crée l’événement avec le même ID, sans doublon aux synchros suivantes', async () => {
    let id = '';
    store.set((s) => {
      const r = createItem(s, draft(), undefined, NOW);
      id = r.id;
      return r.state;
    });
    await run();
    expect(g.live()).toHaveLength(1);
    const ev = g.live()[0];
    expect(ev.id).toBe(id);
    expect(ev.summary).toBe('Réunion');
    expect(ev.start?.dateTime).toBe('2026-11-24T08:00:00.000Z'); // 9 h Paris (UTC+1)
    const it = store.get().items[id];
    expect(it.dirty).toBe(false);
    expect(it.g?.eventId).toBe(id);

    await run();
    await run();
    expect(g.live()).toHaveLength(1);
    expect(items()).toHaveLength(1);
  });

  it('n’envoie pas les créneaux non cochés pour Google', async () => {
    store.set((s) => createItem(s, draft({ sync: false }), undefined, NOW).state);
    await run();
    expect(g.live()).toHaveLength(0);
    expect(items()[0].g).toBeUndefined();
  });

  it('une tâche sans créneau devient un événement « journée entière »', async () => {
    store.set((s) => createItem(s, draft({ kind: 'task', start: null, end: null }), undefined, NOW).state);
    await run();
    expect(g.live()[0].start).toEqual({ date: '2026-11-24' });
    expect(g.live()[0].end).toEqual({ date: '2026-11-25' });
  });

  it('reprend après une coupure entre l’insertion et l’enregistrement du lien (409)', async () => {
    let id = '';
    store.set((s) => {
      const r = createItem(s, draft(), undefined, NOW);
      id = r.id;
      return r.state;
    });
    await g.insertEvent('primary@x', { id, summary: 'Réunion', start: { date: '2026-11-24' }, end: { date: '2026-11-25' } });
    await run();
    expect(g.live()).toHaveLength(1);
    expect(store.get().items[id].g?.eventId).toBe(id);
  });

  it('déplacer un créneau dans l’app le déplace dans Google', async () => {
    let id = '';
    store.set((s) => {
      const r = createItem(s, draft(), undefined, NOW);
      id = r.id;
      return r.state;
    });
    await run();
    store.set((s) => updateItem(s, id, { date: '2026-11-26', start: '14:00', end: '15:00' }, 'one', NOW + 60_000));
    expect(store.get().items[id].dirty).toBe(true);
    await run();
    expect(g.live()[0].start?.dateTime).toBe('2026-11-26T13:00:00.000Z');
    expect(store.get().items[id].dirty).toBe(false);
  });

  it('changer la catégorie ne déclenche pas d’envoi (donnée locale)', async () => {
    let id = '';
    store.set((s) => {
      const r = createItem(s, draft(), undefined, NOW);
      id = r.id;
      return r.state;
    });
    await run();
    store.set((s) => updateItem(s, id, { categoryId: 'cat-sport' }, 'one', NOW));
    expect(store.get().items[id].dirty).toBe(false);
  });

  it('supprimer dans l’app supprime dans Google', async () => {
    let id = '';
    store.set((s) => {
      const r = createItem(s, draft(), undefined, NOW);
      id = r.id;
      return r.state;
    });
    await run();
    store.set((s) => deleteItem(s, id));
    await run();
    expect(g.live()).toHaveLength(0);
    expect(store.get().google.pendingDeletes).toHaveLength(0);
  });

  it('décocher « Envoyer vers Google » retire l’événement de Google mais garde le créneau', async () => {
    let id = '';
    store.set((s) => {
      const r = createItem(s, draft(), undefined, NOW);
      id = r.id;
      return r.state;
    });
    await run();
    store.set((s) => setItemSync(s, id, false, NOW));
    await run();
    expect(g.live()).toHaveLength(0);
    expect(store.get().items[id]).toBeDefined();
    expect(store.get().items[id].g).toBeUndefined();
  });
});

describe('lecture depuis Google', () => {
  it('importe les événements, gère le fuseau et la journée entière', async () => {
    store.set((s) => ({ ...s, google: { ...s.google, calendarCategory: { 'primary@x': 'cat-perso' } } }));
    g.seed('primary@x', { id: 'ev1', summary: 'Dentiste', start: { dateTime: '2026-11-25T16:30:00+01:00' }, end: { dateTime: '2026-11-25T17:15:00+01:00' } });
    g.seed('primary@x', { id: 'ev2', summary: 'Vacances', start: { date: '2026-12-21' }, end: { date: '2026-12-24' } });
    // Été : UTC+2
    g.seed('primary@x', { id: 'ev3', summary: 'Été', start: { dateTime: '2027-06-01T08:00:00Z' }, end: { dateTime: '2027-06-01T09:00:00Z' } });
    // Événement New York converti en heure de Paris
    g.seed('primary@x', { id: 'ev4', summary: 'Call NY', start: { dateTime: '2026-11-26T09:00:00-05:00', timeZone: 'America/New_York' }, end: { dateTime: '2026-11-26T10:00:00-05:00' } });
    await run();
    const byTitle = Object.fromEntries(items().map((i) => [i.title, i]));
    expect(byTitle.Dentiste).toMatchObject({ date: '2026-11-25', start: '16:30', end: '17:15', origin: 'google', categoryId: 'cat-perso' });
    expect(byTitle.Vacances).toMatchObject({ date: '2026-12-21', endDate: '2026-12-23', start: null, end: null });
    expect(byTitle['Été']).toMatchObject({ date: '2027-06-01', start: '10:00', end: '11:00' });
    expect(byTitle['Call NY']).toMatchObject({ date: '2026-11-26', start: '15:00', end: '16:00' });
  });

  it('répercute une modification et une suppression faites dans Google', async () => {
    g.seed('primary@x', { id: 'ev1', summary: 'Sport', start: { dateTime: '2026-11-25T07:00:00+01:00' }, end: { dateTime: '2026-11-25T08:00:00+01:00' } });
    await run();
    const local = items()[0];
    store.set((s) => updateItem(s, local.id, { categoryId: 'cat-sport', subtasks: [{ id: 'a', text: 'Échauffement', done: false }] }, 'one', NOW));

    g.edit('primary@x', 'ev1', { summary: 'Sport (salle)', start: { dateTime: '2026-11-25T18:00:00+01:00' }, end: { dateTime: '2026-11-25T19:30:00+01:00' } });
    await run();
    const after = store.get().items[local.id];
    expect(after).toMatchObject({ title: 'Sport (salle)', start: '18:00', end: '19:30', categoryId: 'cat-sport' });
    expect(after.subtasks).toHaveLength(1); // données locales conservées

    g.remove('primary@x', 'ev1');
    await run();
    expect(items()).toHaveLength(0);
  });

  it('déplacer un événement Google depuis l’app met Google à jour', async () => {
    g.seed('primary@x', { id: 'ev1', summary: 'Point', start: { dateTime: '2026-11-25T10:00:00+01:00' }, end: { dateTime: '2026-11-25T11:00:00+01:00' } });
    await run();
    const id = items()[0].id;
    store.set((s) => updateItem(s, id, { start: '11:00', end: '12:30' }, 'one', NOW + 5000));
    await run();
    expect(g.live()[0].start?.dateTime).toBe('2026-11-25T10:00:00.000Z');
    expect(g.live()[0].end?.dateTime).toBe('2026-11-25T11:30:00.000Z');
    expect(items()).toHaveLength(1);
  });

  it('conflit : la modification la plus récente l’emporte', async () => {
    g.seed('primary@x', { id: 'ev1', summary: 'A', start: { dateTime: '2026-11-25T10:00:00+01:00' }, end: { dateTime: '2026-11-25T11:00:00+01:00' } });
    await run();
    const id = items()[0].id;
    // Modification locale ancienne, puis modification Google plus récente
    store.set((s) => updateItem(s, id, { title: 'Local' }, 'one', g.clock - 3600_000));
    g.edit('primary@x', 'ev1', { summary: 'Google' });
    await run();
    expect(store.get().items[id].title).toBe('Google');
    expect(g.live()[0].summary).toBe('Google');

    // Modification locale plus récente que Google
    g.edit('primary@x', 'ev1', { summary: 'Google 2' });
    store.set((s) => updateItem(s, id, { title: 'Local 2' }, 'one', g.clock + 3600_000));
    await run();
    expect(store.get().items[id].title).toBe('Local 2');
    expect(g.live()[0].summary).toBe('Local 2');
  });

  it('agenda en lecture seule : affiché mais jamais modifié', async () => {
    store.set((s) => ({ ...s, google: { ...s.google, selected: ['primary@x', 'feries'], calendars: g.calendars } }));
    g.seed('feries', { id: 'noel', summary: 'Noël', start: { date: '2026-12-25' }, end: { date: '2026-12-26' } });
    await run();
    const it = items().find((i) => i.title === 'Noël')!;
    expect(it.g?.readOnly).toBe(true);
    store.set((s) => updateItem(s, it.id, { title: 'Noël !' }, 'one', NOW));
    await run();
    expect(g.calls.some((c) => c.startsWith('patch'))).toBe(false);
  });
});

describe('événements récurrents', () => {
  function seedDaily() {
    g.seed('primary@x', {
      id: 'rec1', summary: 'Footing', recurrence: ['RRULE:FREQ=DAILY;UNTIL=20261127T225959Z'],
      start: { dateTime: '2026-11-23T07:00:00+01:00', timeZone: 'Europe/Paris' },
      end: { dateTime: '2026-11-23T07:45:00+01:00', timeZone: 'Europe/Paris' },
    });
  }

  it('affiche chaque occurrence, sans doublon', async () => {
    seedDaily();
    await run();
    await run();
    const occ = items().filter((i) => i.g?.recurringEventId === 'rec1');
    expect(occ.map((o) => o.date).sort()).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
    expect(occ.every((o) => o.start === '07:00' && o.end === '07:45')).toBe(true);
  });

  it('déplacer une occurrence ne touche que celle-ci', async () => {
    seedDaily();
    await run();
    const wed = items().find((i) => i.date === '2026-11-25')!;
    store.set((s) => updateItem(s, wed.id, { start: '19:00', end: '19:45' }, 'one', NOW + 10_000));
    await run();
    const list = await g.listEvents('primary@x', '2026-11-22T00:00:00Z', '2026-11-29T00:00:00Z');
    expect(list.find((e) => e.id === wed.g!.eventId)!.start!.dateTime).toBe('2026-11-25T18:00:00.000Z');
    expect(list.filter((e) => e.start!.dateTime!.endsWith('06:00:00.000Z'))).toHaveLength(4);
    expect(items()).toHaveLength(5);
  });

  it('modifier toute la série passe par l’événement maître', async () => {
    seedDaily();
    await run();
    const first = items()[0];
    store.set((s) => updateItem(s, first.id, { title: 'Course', start: '06:30', end: '07:30', categoryId: 'cat-sport' }, 'series', NOW));
    expect(store.get().google.masterPatches).toHaveLength(1);
    await run();
    expect(g.live()[0].summary).toBe('Course');
    expect(items().every((i) => i.title === 'Course' && i.start === '06:30' && i.categoryId === 'cat-sport')).toBe(true);
  });

  it('supprimer une occurrence puis toute la série', async () => {
    seedDaily();
    await run();
    const tue = items().find((i) => i.date === '2026-11-24')!;
    store.set((s) => deleteItem(s, tue.id, 'one'));
    await run();
    expect(items()).toHaveLength(4);
    store.set((s) => deleteItem(s, items()[0].id, 'series'));
    await run();
    expect(items()).toHaveLength(0);
    expect(g.live()).toHaveLength(0);
  });

  it('une répétition créée dans l’app devient un événement récurrent Google', async () => {
    store.set((s) => createItem(s, draft({ title: 'Salle', date: '2026-11-23', start: '18:00', end: '19:00' }), { freq: 'weekly', byDay: [0, 3], until: '2026-12-06' }, NOW).state);
    const local = items();
    expect(local.map((i) => i.date).sort()).toEqual(['2026-11-23', '2026-11-26', '2026-11-30', '2026-12-03']);
    await run();
    expect(g.live()).toHaveLength(1);
    expect(g.live()[0].recurrence?.[0]).toContain('FREQ=WEEKLY;BYDAY=MO,TH');
    // Chaque occurrence locale est liée à son occurrence Google, sans doublon
    expect(items()).toHaveLength(4);
    expect(items().every((i) => i.g?.recurringEventId === g.live()[0].id)).toBe(true);
    await run();
    expect(items()).toHaveLength(4);

    // Supprimer une occurrence
    const thu = items().find((i) => i.date === '2026-11-26')!;
    store.set((s) => deleteItem(s, thu.id, 'one'));
    await run();
    const list = await g.listEvents('primary@x', '2026-11-22T00:00:00Z', '2026-12-10T00:00:00Z');
    expect(list.map((e) => e.originalStartTime?.dateTime?.slice(0, 10)).sort()).toEqual(['2026-11-23', '2026-11-30', '2026-12-03']);
  });

  it('occurrence supprimée avant le premier envoi : supprimée aussi dans Google', async () => {
    store.set((s) => createItem(s, draft({ title: 'Yoga', date: '2026-11-23', start: '08:00', end: '09:00' }), { freq: 'daily', until: '2026-11-25' }, NOW).state);
    const tue = items().find((i) => i.date === '2026-11-24')!;
    store.set((s) => deleteItem(s, tue.id, 'one'));
    await run();
    expect(items().map((i) => i.date).sort()).toEqual(['2026-11-23', '2026-11-25']);
    const list = await g.listEvents('primary@x', '2026-11-22T00:00:00Z', '2026-11-30T00:00:00Z');
    expect(list).toHaveLength(2);
  });
});

describe('robustesse', () => {
  it('une modification faite pendant la synchro n’est pas perdue', async () => {
    let id = '';
    store.set((s) => {
      const r = createItem(s, draft(), undefined, NOW);
      id = r.id;
      return r.state;
    });
    const orig = g.insertEvent.bind(g);
    g.insertEvent = async (cal, body) => {
      const r = await orig(cal, body);
      store.set((s) => updateItem(s, id, { title: 'Renommé pendant la synchro' }, 'one', NOW + 1));
      return r;
    };
    await run();
    expect(store.get().items[id].dirty).toBe(true);
    g.insertEvent = orig;
    await run();
    expect(g.live()[0].summary).toBe('Renommé pendant la synchro');
  });

  it('les éléments d’une catégorie conservent leur catégorie après de multiples synchros', async () => {
    g.seed('primary@x', { id: 'x', summary: 'X', start: { dateTime: '2026-11-25T10:00:00+01:00' }, end: { dateTime: '2026-11-25T11:00:00+01:00' } });
    await run();
    const it: Item = items()[0];
    store.set((s) => updateItem(s, it.id, { categoryId: 'cat-perso' }));
    g.edit('primary@x', 'x', { summary: 'Y' });
    await run();
    expect(store.get().items[it.id].categoryId).toBe('cat-perso');
  });
});
