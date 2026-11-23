import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, Check, ChevronLeft, ChevronRight, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import TimeGrid from '../components/TimeGrid';
import { Segmented, useUI } from '../components/ui';
import { updateItem } from '../lib/actions';
import { itemColor } from '../lib/colors';
import {
  addDays, fromMinutes, isoWeek, JOURS_COURTS, labelDay, labelMonthYear, parseISO, weekDays,
} from '../lib/dates';
import { setSyncFocus, syncNow, useGoogleRuntime } from '../lib/google/client';
import { update, useApp } from '../lib/store';
import type { Item, ISODate } from '../lib/types';
import { useNow } from '../useNow';

type Mode = 'week' | 'day';

export default function AgendaScreen() {
  const ui = useUI();
  const { today, minutes } = useNow();
  const items = useApp((s) => s.items);
  const categories = useApp((s) => s.categories);
  const google = useApp((s) => s.google);
  const rt = useGoogleRuntime();
  const [mode, setMode] = useState<Mode>(() => (sessionStorage.getItem('givre:mode') as Mode) || 'week');
  const [date, setDate] = useState<ISODate>(today);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => sessionStorage.setItem('givre:mode', mode), [mode]);
  useEffect(() => setSyncFocus(date), [date]);

  const week = useMemo(() => weekDays(date), [date]);
  const days = mode === 'week' ? week : [date];
  const state = { categories, google };

  const visible = useMemo(() => {
    const set = new Set(days);
    const first = days[0];
    const last = days[days.length - 1];
    return Object.values(items).filter((it) => {
      if (filter && (it.categoryId ?? '__none') !== filter) return false;
      if (set.has(it.date)) return true;
      return !it.start && !!it.endDate && it.date <= last && it.endDate >= first;
    });
  }, [items, days, filter]);

  const colorOf = (it: Item) => itemColor(state, it);
  const counts = useMemo(() => {
    const m = new Map<ISODate, string[]>();
    for (const it of Object.values(items)) {
      if (!week.includes(it.date)) continue;
      const arr = m.get(it.date) ?? [];
      if (arr.length < 3) arr.push(colorOf(it));
      m.set(it.date, arr);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, week, categories, google.calendars]);

  const step = (dir: number) => setDate((d) => addDays(d, dir * (mode === 'week' ? 7 : 1)));
  const wk = isoWeek(week[0]);
  const untimedDay = mode === 'day' ? visible.filter((i) => !i.start) : [];

  const syncIcon = !google.session ? null : rt.syncing ? (
    <RefreshCw size={15} className="spin" />
  ) : google.lastError ? <CloudOff size={15} color="var(--danger)" /> : <Cloud size={15} />;

  return (
    <div className="screen fixed">
      <div className="agenda-head">
        <div className="topbar">
          <div>
            <div className="eyebrow row" style={{ gap: 8 }}>
              <span>Semaine {wk}</span>
              {syncIcon && (
                <button className="sync-dot" onClick={() => syncNow()} aria-label="Synchroniser avec Google Agenda">
                  {syncIcon}
                </button>
              )}
            </div>
            <h1 className="title">{mode === 'day' ? labelDay(date) : labelMonthYear(week[3])}</h1>
          </div>
          <div className="row">
            <button className="icon-btn" onClick={() => setDate(today)} aria-label="Aujourd'hui">
              <CalendarCheck2 size={19} />
            </button>
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn sm" onClick={() => step(-1)} aria-label="Précédent"><ChevronLeft size={18} /></button>
          <div className="grow">
            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              options={[{ value: 'week', label: 'Semaine' }, { value: 'day', label: 'Jour' }]}
            />
          </div>
          <button className="icon-btn sm" onClick={() => step(1)} aria-label="Suivant"><ChevronRight size={18} /></button>
        </div>

        {mode === 'day' && (
          <div className="weekstrip" style={{ marginTop: 12 }}>
            <div className="days">
              {week.map((d, i) => (
                <button
                  key={d}
                  className={`daypill ${d === date ? 'on' : ''} ${d === today ? 'today' : ''}`}
                  onClick={() => setDate(d)}
                >
                  <span className="wd">{JOURS_COURTS[i]}</span>
                  <span className="dn num">{parseISO(d).d}</span>
                  <span className="dots">{(counts.get(d) ?? []).map((c, j) => <i key={j} style={{ background: c }} />)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="chips" style={{ marginTop: 12 }}>
          <button className={`chip ${filter === null ? 'on' : ''}`} onClick={() => setFilter(null)}>Tout</button>
          {categories.map((c) => (
            <button key={c.id} className={`chip ${filter === c.id ? 'on' : ''}`} onClick={() => setFilter(filter === c.id ? null : c.id)}>
              <span className="dot" style={{ background: c.color }} /> {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="agenda-body">
        <TimeGrid
          days={days}
          items={visible}
          rich={mode === 'day'}
          hourHeight={mode === 'day' ? 68 : 46}
          today={today}
          nowMinutes={minutes}
          colorOf={colorOf}
          onOpen={(id) => ui.open({ type: 'item', id })}
          onCreate={(d, min) => ui.open({ type: 'item', preset: { kind: 'event', date: d, start: fromMinutes(min), end: fromMinutes(Math.min(1440, min + 60)) } })}
          onCommit={(id, patch) => {
            update((s) => updateItem(s, id, patch));
            ui.toast(`Déplacé : ${labelDay(patch.date).split(' ').slice(0, 2).join(' ')}, ${patch.start.replace(':', ' h ')}`);
          }}
          onToggleDone={(id) => update((s) => updateItem(s, id, { done: !s.items[id].done }))}
          onPickDay={(d) => {
            setDate(d);
            setMode('day');
          }}
          top={mode === 'day' && untimedDay.length > 0 ? (
            <div className="untimed" style={{ marginTop: 10 }}>
              <div className="head"><span>Sans horaire · non compté dans les statistiques</span><span>{untimedDay.length}</span></div>
              {untimedDay.map((it) => (
                <div key={it.id} className={`task-row ${it.done ? 'done' : ''}`} style={{ ['--c' as any]: colorOf(it) }}>
                  <span className="bar" />
                  <button className="grow" style={{ textAlign: 'left' }} onClick={() => ui.open({ type: 'item', id: it.id })}>
                    <div className="ttl">{it.title}</div>
                    <div className="tiny muted">
                      {it.kind === 'task' ? 'Tâche' : 'Journée entière'}
                      {it.endDate ? ` · jusqu’au ${parseISO(it.endDate).d}/${parseISO(it.endDate).m}` : ''}
                      {it.subtasks.length ? ` · ${it.subtasks.filter((x) => x.done).length}/${it.subtasks.length}` : ''}
                    </div>
                  </button>
                  {it.kind === 'task' && (
                    <button
                      className={`check ${it.done ? 'on' : ''}`}
                      onClick={() => update((s) => updateItem(s, it.id, { done: !it.done }))}
                      aria-label="Cocher la tâche"
                    >
                      <Check size={15} strokeWidth={3} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : undefined}
        />
      </div>
    </div>
  );
}
