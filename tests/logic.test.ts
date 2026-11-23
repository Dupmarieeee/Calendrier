import { describe, expect, it } from 'vitest';
import { createItem, defaultState, toggleHabit, updateItem } from '../src/lib/actions';
import { addDays, formatDuration, fromParis, isoWeek, startOfWeek, toParis, weekDays } from '../src/lib/dates';
import { challengeProgress, dayScore, habitRate, weekStats } from '../src/lib/stats';
import type { AppState } from '../src/lib/types';

const NOW = Date.parse('2026-11-23T08:00:00Z');

describe('dates et fuseau Europe/Paris', () => {
  it('convertit dans les deux sens, y compris aux changements d’heure', () => {
    expect(new Date(fromParis('2026-11-23', '09:00')).toISOString()).toBe('2026-11-23T08:00:00.000Z');
    expect(new Date(fromParis('2026-07-01', '09:00')).toISOString()).toBe('2026-07-01T07:00:00.000Z');
    // Passage à l'heure d'été le 29 mars 2026 à 2 h → 3 h
    expect(new Date(fromParis('2026-03-29', '01:30')).toISOString()).toBe('2026-03-29T00:30:00.000Z');
    expect(new Date(fromParis('2026-03-29', '03:30')).toISOString()).toBe('2026-03-29T01:30:00.000Z');
    // Retour à l'heure d'hiver le 25 octobre 2026
    expect(new Date(fromParis('2026-10-25', '04:00')).toISOString()).toBe('2026-10-25T03:00:00.000Z');
    expect(toParis(Date.parse('2026-12-31T23:30:00Z'))).toEqual({ date: '2027-01-01', time: '00:30' });
  });

  it('semaines ISO commençant le lundi', () => {
    expect(startOfWeek('2026-11-29')).toBe('2026-11-23');
    expect(weekDays('2026-11-25')[6]).toBe('2026-11-29');
    expect(isoWeek('2026-11-23')).toBe(48);
    expect(isoWeek('2027-01-01')).toBe(53);
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('formate les durées en heures et minutes', () => {
    expect(formatDuration(90)).toBe('1 h 30');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2 h');
  });
});

describe('statistiques hebdomadaires', () => {
  function withItems(): { s: AppState; ids: string[] } {
    let s = defaultState(NOW);
    const ids: string[] = [];
    const add = (p: any) => {
      const r = createItem(s, { kind: 'event', title: 't', notes: '', subtasks: [], sync: false, categoryId: 'cat-travail', date: '2026-11-24', start: '09:00', end: '11:00', ...p }, undefined, NOW);
      s = r.state;
      ids.push(r.id);
    };
    add({});
    add({ categoryId: 'cat-sport', start: '18:00', end: '19:15' });
    add({ kind: 'task', start: null, end: null }); // sans créneau
    add({ date: '2026-12-01' }); // semaine suivante
    add({ categoryId: null, date: '2026-11-29', start: '23:00', end: '00:30' }); // passe minuit
    return { s, ids };
  }

  it('additionne par catégorie et exclut les tâches sans créneau', () => {
    const { s } = withItems();
    const w = weekStats(s, weekDays('2026-11-23'));
    const by = Object.fromEntries(w.totals.map((t) => [t.category.name, t.minutes]));
    expect(by).toEqual({ Travail: 120, Sport: 75, 'Sans catégorie': 90 });
    expect(w.totalMinutes).toBe(285);
    expect(w.untimedCount).toBe(1);
    expect(w.perDay[1]).toBe(195);
  });

  it('se met à jour quand on déplace, redimensionne ou change de catégorie', () => {
    const { s, ids } = withItems();
    let s2 = updateItem(s, ids[0], { end: '12:00' });
    s2 = updateItem(s2, ids[1], { categoryId: 'cat-travail' });
    s2 = updateItem(s2, ids[3], { date: '2026-11-27' });
    const w = weekStats(s2, weekDays('2026-11-23'));
    const by = Object.fromEntries(w.totals.map((t) => [t.category.name, t.minutes]));
    expect(by.Travail).toBe(180 + 75 + 120);
    expect(by.Sport).toBeUndefined();
  });
});

describe('Winter Arc', () => {
  function base() {
    const s = defaultState(NOW);
    s.challenge = { name: 'Winter Arc', startDate: '2026-11-16', endDate: '2027-02-13' };
    for (const h of s.habits) h.since = '2026-11-16';
    return s;
  }

  it('compte les habitudes prévues du jour (quotidiennes + jours choisis)', () => {
    const s = base();
    // Lundi : 4 habitudes (sport lun/mer/ven), mardi : 3
    expect(dayScore(s, '2026-11-23').total).toBe(4);
    expect(dayScore(s, '2026-11-24').total).toBe(3);
    const s2 = toggleHabit(s, '2026-11-23', s.habits[0].id);
    expect(dayScore(s2, '2026-11-23')).toEqual({ done: 1, total: 4 });
    expect(dayScore(toggleHabit(s2, '2026-11-23', s.habits[0].id), '2026-11-23').done).toBe(0);
  });

  it('taux de réussite par habitude et progression globale, correction d’un jour passé', () => {
    let s = base();
    const water = s.habits[1];
    for (let d = '2026-11-16'; d <= '2026-11-23'; d = addDays(d, 1)) {
      if (d !== '2026-11-18') s = toggleHabit(s, d, water.id);
    }
    expect(habitRate(s, water, '2026-11-23')).toMatchObject({ done: 7, scheduled: 8 });
    s = toggleHabit(s, '2026-11-18', water.id); // case oubliée corrigée
    expect(habitRate(s, water, '2026-11-23').rate).toBe(1);

    const p = challengeProgress(s, '2026-11-23');
    expect(p.totalDays).toBe(90);
    expect(p.dayIndex).toBe(8);
  });

  it('série de jours parfaits', () => {
    let s = base();
    for (const d of ['2026-11-20', '2026-11-21', '2026-11-22']) {
      for (const h of s.habits) if (dayScore(s, d).total && (!h.days || h.days.includes((new Date(d).getUTCDay() + 6) % 7))) s = toggleHabit(s, d, h.id);
    }
    const p = challengeProgress(s, '2026-11-23');
    expect(p.currentStreak).toBe(3); // aujourd'hui pas encore terminé ne casse pas la série
    expect(p.bestStreak).toBe(3);
  });
});
