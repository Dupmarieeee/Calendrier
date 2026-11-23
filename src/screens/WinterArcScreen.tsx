import { useMemo, useState } from 'react';
import { CalendarClock, Check, CheckCheck, ChevronLeft, ChevronRight, Flame, Hourglass, ListTodo, Pencil, Plus, Target } from 'lucide-react';
import Hello from '../components/Hello';
import { Ring, Segmented, useUI, vibrate } from '../components/ui';
import { toggleHabit } from '../lib/actions';
import {
  addDays, addMonths, daysInMonth, JOURS_COURTS, JOURS_LETTRE, labelDate, labelDay, labelMonthYear, maxDate, minDate, startOfMonth, weekday,
} from '../lib/dates';
import { challengeProgress, dayScore, habitRate, habitsForDay } from '../lib/stats';
import { update, useApp } from '../lib/store';
import type { AppState, Habit, ISODate } from '../lib/types';
import { useNow } from '../useNow';

type Tab = 'today' | 'calendar' | 'progress';

export default function WinterArcScreen() {
  const ui = useUI();
  const { today } = useNow();
  const challenge = useApp((s) => s.challenge);
  const [tab, setTab] = useState<Tab>('today');
  const state = useAppState();
  const progress = useMemo(() => challengeProgress(state, today), [state, today]);
  const before = today < challenge.startDate;
  const after = today > challenge.endDate;

  return (
    <div className="screen">
      <Hello
        right={
          <>
            <button className="icon-btn dark" onClick={() => ui.open({ type: 'habit' })} aria-label="Nouvelle habitude"><Plus size={20} /></button>
            <button className="icon-btn" onClick={() => ui.open({ type: 'challenge' })} aria-label="Modifier le challenge"><Pencil size={18} /></button>
          </>
        }
      />

      <h1 className="display">
        {before ? <>Ton {challenge.name}<br />commence bientôt</> : after ? <>{challenge.name}<br />terminé 🎉</> : <>Jour {progress.dayIndex} de ton<br />{challenge.name}</>}
      </h1>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'today', label: 'Aujourd’hui' },
          { value: 'calendar', label: 'Historique' },
          { value: 'progress', label: 'Progrès' },
        ]}
      />

      <div style={{ marginTop: 16 }}>
        {tab === 'today' && <DayView initial={minDate(maxDate(today, challenge.startDate), challenge.endDate)} onHistory={() => setTab('calendar')} />}
        {tab === 'calendar' && <HistoryView />}
        {tab === 'progress' && <ProgressView />}
      </div>
    </div>
  );
}

/** Sélecteur stable sur l'état complet pour les calculs du challenge. */
function useAppState(): AppState {
  const challenge = useApp((s) => s.challenge);
  const habits = useApp((s) => s.habits);
  const habitLog = useApp((s) => s.habitLog);
  return useMemo(() => ({ challenge, habits, habitLog }) as AppState, [challenge, habits, habitLog]);
}

const scheduleLabel = (h: Habit) => (h.days ? h.days.map((d) => JOURS_COURTS[d]).join(', ') : 'Tous les jours');

// ---------------------------------------------------------------- Checklist d'un jour
type Filter = 'all' | 'todo' | 'done';

export function HabitChecklist({ date, filter = 'all' }: { date: ISODate; filter?: Filter }) {
  const ui = useUI();
  const state = useAppState();
  const log = state.habitLog[date] ?? {};
  const all = habitsForDay(state, date);
  const list = all.filter((h) => (filter === 'all' ? true : filter === 'done' ? !!log[h.id] : !log[h.id]));
  const { today } = useNow();
  const future = date > today;

  if (!all.length) {
    return (
      <div className="card empty">
        <div className="t">Aucune habitude prévue ce jour-là</div>
        <div className="small">Ajoutez une habitude quotidienne ou programmée certains jours.</div>
        <button className="btn sm primary" style={{ marginTop: 14 }} onClick={() => ui.open({ type: 'habit' })}>
          <Plus size={16} /> Ajouter une habitude
        </button>
      </div>
    );
  }
  if (!list.length) {
    return <div className="card empty"><div className="t">{filter === 'todo' ? 'Tout est validé 🎉' : 'Rien de validé pour l’instant'}</div></div>;
  }
  return (
    <div>
      {list.map((h) => {
        const done = !!log[h.id];
        return (
          <button
            key={h.id}
            className={`habit ${done ? 'done' : ''}`}
            style={{ ['--c' as any]: h.color }}
            disabled={future}
            onClick={() => {
              vibrate(8);
              update((s) => toggleHabit(s, date, h.id));
            }}
            aria-pressed={done}
          >
            <span className="kicker"><i /> {scheduleLabel(h)}</span>
            <div className="name"><span>{h.emoji}</span> {h.name}</div>
            <div className="tgt"><Target size={14} /> {h.target || 'Objectif du jour'}</div>
            <span className={`check ${done ? 'on' : ''}`}><Check size={20} strokeWidth={3} /></span>
          </button>
        );
      })}
      {future && <p className="small muted" style={{ textAlign: 'center' }}>Jour à venir : les cases se cocheront le jour même.</p>}
    </div>
  );
}

function DayView({ initial, onHistory }: { initial: ISODate; onHistory: () => void }) {
  const { today } = useNow();
  const state = useAppState();
  const [date, setDate] = useState(initial);
  const [filter, setFilter] = useState<Filter>('all');
  const { done, total } = dayScore(state, date);
  const p = challengeProgress(state, today);
  const { startDate, endDate } = state.challenge;
  const isToday = date === today;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <div className="hero">
        <div className="hero-title">
          <span>{isToday ? 'Progression du jour' : labelDay(date)}</span>
          <span className="row" style={{ gap: 6 }}>
            <button className="icon-btn sm" disabled={date <= startDate} onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent">
              <ChevronLeft size={17} />
            </button>
            <button className="icon-btn sm" disabled={date >= minDate(today, endDate)} onClick={() => setDate(addDays(date, 1))} aria-label="Jour suivant">
              <ChevronRight size={17} />
            </button>
          </span>
        </div>
        <div className="hero-split">
          <Ring value={total ? done / total : 0} size={118} stroke={12}>
            <div className="v">{pct} %</div>
          </Ring>
          <span className="divider" />
          <div className="stat-list">
            <div className="stat"><span className="ic"><ListTodo size={15} /></span><div><div className="v">{total}</div><div className="l">Habitudes prévues</div></div></div>
            <div className="stat"><span className="ic"><CheckCheck size={15} /></span><div><div className="v">{done}</div><div className="l">Validées</div></div></div>
            <div className="stat"><span className="ic"><Hourglass size={15} /></span><div><div className="v">{total - done}</div><div className="l">Restantes</div></div></div>
          </div>
        </div>
        <div className="row small muted" style={{ marginTop: 14, gap: 14 }}>
          <span className="row" style={{ gap: 5, color: 'var(--hero-ink)' }}><Flame size={15} color="#ffb86b" /> {p.currentStreak} j de série</span>
          <span>{Math.round(p.rate * 100)} % de réussite globale</span>
          {!isToday && (
            <button className="row" style={{ gap: 4, marginLeft: 'auto', color: 'var(--hero-ink)' }} onClick={() => setDate(minDate(maxDate(today, startDate), endDate))}>
              <CalendarClock size={14} /> Aujourd’hui
            </button>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h3 className="section-title">{isToday ? 'Habitudes du jour' : 'Corriger ce jour'}</h3>
          <button className="link" onClick={onHistory}>Historique</button>
        </div>
        <div className="chips" style={{ marginBottom: 12 }}>
          <button className={`chip ${filter === 'todo' ? 'lime' : ''}`} onClick={() => setFilter(filter === 'todo' ? 'all' : 'todo')}>
            <span className="count">{total - done}</span> À faire
          </button>
          <button className={`chip ${filter === 'done' ? 'lime' : ''}`} onClick={() => setFilter(filter === 'done' ? 'all' : 'done')}>
            <span className="count">{done}</span> Validées
          </button>
          <button className={`chip ${filter === 'all' ? 'lime' : ''}`} onClick={() => setFilter('all')}>
            <span className="count">{total}</span> Toutes
          </button>
        </div>
        <HabitChecklist date={date} filter={filter} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Historique (calendrier)
function HistoryView() {
  const ui = useUI();
  const { today } = useNow();
  const state = useAppState();
  const { startDate, endDate } = state.challenge;
  const months: ISODate[] = [];
  for (let m = startOfMonth(startDate); m <= endDate; m = addMonths(m, 1)) months.push(m);

  return (
    <>
      <div className="legend" style={{ margin: '0 4px 14px' }}>
        <span><i style={{ background: 'var(--lime)' }} /> Tout validé</span>
        <span><i className="partial" /> Partiel</span>
        <span><i style={{ background: 'var(--surface)', border: '1px solid var(--line)' }} /> Rien</span>
      </div>
      <p className="small muted" style={{ margin: '0 4px 14px' }}>Touchez un jour passé pour corriger une case oubliée.</p>
      {[
        // Mois en cours d'abord, puis les mois passés, puis ceux à venir
        ...months.filter((m) => m <= startOfMonth(today)).reverse(),
        ...months.filter((m) => m > startOfMonth(today)),
      ].map((m) => {
        const offset = weekday(m);
        const n = daysInMonth(m);
        return (
          <div key={m} className="card month">
            <h4>{labelMonthYear(m)}</h4>
            <div className="cal">
              {JOURS_LETTRE.map((l, i) => <div key={i} className="wd">{l}</div>)}
              {Array.from({ length: offset }, (_, i) => <div key={`o${i}`} />)}
              {Array.from({ length: n }, (_, i) => {
                const d = addDays(m, i);
                const inRange = d >= startDate && d <= endDate;
                const isFuture = d > today;
                const s = inRange ? dayScore(state, d) : { done: 0, total: 0 };
                const ratio = s.total ? s.done / s.total : 0;
                const full = !isFuture && s.total > 0 && ratio === 1;
                const zero = inRange && !isFuture && d !== today && s.total > 0 && s.done === 0;
                return (
                  <button
                    key={d}
                    className={`d ${!inRange ? 'out' : ''} ${isFuture ? 'future' : ''} ${full ? 'full' : ''} ${d === today ? 'today' : ''} ${zero ? 'zero' : ''}`}
                    disabled={!inRange || isFuture}
                    onClick={() => ui.open({ type: 'habitDay', date: d })}
                    aria-label={`${labelDay(d)} : ${s.done} sur ${s.total}`}
                  >
                    {inRange && !isFuture && ratio > 0 && !full && <span className="arc" style={{ ['--p' as any]: `${ratio * 100}%` }} />}
                    {full && <span className="fill" />}
                    <span>{i + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- Progrès
function ProgressView() {
  const ui = useUI();
  const { today } = useNow();
  const state = useAppState();
  const p = challengeProgress(state, today);
  const rates = state.habits.filter((h) => !h.archived).map((h) => habitRate(state, h, today));
  const remaining = Math.max(0, p.totalDays - p.dayIndex);

  return (
    <>
      <div className="hero">
        <div className="hero-title"><span>Progression du challenge</span></div>
        <div className="hero-split">
          <Ring value={p.dayIndex / p.totalDays} size={118} stroke={12}>
            <div className="v">{Math.round((p.dayIndex / p.totalDays) * 100)} %</div>
            <div className="s">du challenge</div>
          </Ring>
          <span className="divider" />
          <div className="stat-list">
            <div className="stat"><span className="ic"><CalendarClock size={15} /></span><div><div className="v">{p.dayIndex}/{p.totalDays}</div><div className="l">Jours écoulés</div></div></div>
            <div className="stat"><span className="ic"><Hourglass size={15} /></span><div><div className="v">{remaining}</div><div className="l">Jours restants</div></div></div>
            <div className="stat"><span className="ic"><Target size={15} /></span><div><div className="v" style={{ fontSize: 14 }}>{labelDate(state.challenge.endDate)}</div><div className="l">Fin du challenge</div></div></div>
          </div>
        </div>
        <div className="progress" style={{ marginTop: 16 }}><i style={{ width: `${(p.dayIndex / p.totalDays) * 100}%` }} /></div>
      </div>

      <div className="kpis" style={{ marginTop: 12 }}>
        <div className="kpi"><div className="v">{Math.round(p.rate * 100)} %</div><div className="l">Réussite globale · {p.done}/{p.scheduled}</div></div>
        <div className="kpi"><div className="v">{p.perfectDays}</div><div className="l">Jours parfaits</div></div>
        <div className="kpi"><div className="v row" style={{ gap: 6 }}><Flame size={22} color="#ffb86b" />{p.currentStreak}</div><div className="l">Série en cours (jours)</div></div>
        <div className="kpi"><div className="v">{p.bestStreak}</div><div className="l">Meilleure série</div></div>
      </div>

      <div className="section">
        <div className="section-head">
          <h3 className="section-title">Réussite par habitude</h3>
          <button className="link row" style={{ gap: 4 }} onClick={() => ui.open({ type: 'habit' })}><Plus size={14} /> Ajouter</button>
        </div>
        <div className="card" style={{ padding: '4px 16px' }}>
          {rates.length === 0 && <div className="empty">Aucune habitude pour l’instant.</div>}
          {rates.map((r) => (
            <button key={r.habit.id} className="list-row" style={{ width: '100%', textAlign: 'left', flexWrap: 'wrap', rowGap: 8 }} onClick={() => ui.open({ type: 'habit', id: r.habit.id })}>
              <span style={{ fontSize: 22 }}>{r.habit.emoji}</span>
              <span className="grow">
                <div className="ttl">{r.habit.name}</div>
                <div className="tiny muted">{r.habit.target} · {r.habit.days ? r.habit.days.map((d) => JOURS_LETTRE[d]).join(' ') : 'tous les jours'}</div>
              </span>
              <span className="num" style={{ textAlign: 'right' }}>
                <strong>{Math.round(r.rate * 100)} %</strong>
                <div className="tiny muted">{r.done}/{r.scheduled} j</div>
              </span>
              <span className="progress" style={{ width: '100%' }}>
                <i style={{ width: `${r.rate * 100}%`, background: r.habit.color }} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
