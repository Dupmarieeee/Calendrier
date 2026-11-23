import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Flame, Pencil, Plus, Snowflake } from 'lucide-react';
import { Ring, Segmented, useUI, vibrate } from '../components/ui';
import { toggleHabit } from '../lib/actions';
import {
  addDays, addMonths, daysInMonth, JOURS_LETTRE, labelDate, labelDay, labelMonthYear, maxDate, minDate, startOfMonth, weekday,
} from '../lib/dates';
import { challengeProgress, dayScore, habitRate, habitsForDay } from '../lib/stats';
import { update, useApp } from '../lib/store';
import type { AppState, ISODate } from '../lib/types';
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
      <div className="topbar">
        <div>
          <div className="eyebrow row" style={{ gap: 6 }}>
            <Snowflake size={14} />
            {before ? `Commence le ${labelDate(challenge.startDate)}` : after ? 'Challenge terminé' : `Jour ${progress.dayIndex} sur ${progress.totalDays}`}
          </div>
          <h1 className="title">{challenge.name}</h1>
        </div>
        <button className="icon-btn" onClick={() => ui.open({ type: 'challenge' })} aria-label="Modifier le challenge">
          <Pencil size={18} />
        </button>
      </div>

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
        {tab === 'today' && <DayView initial={minDate(maxDate(today, challenge.startDate), challenge.endDate)} />}
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

// ---------------------------------------------------------------- Checklist d'un jour
export function HabitChecklist({ date }: { date: ISODate }) {
  const ui = useUI();
  const state = useAppState();
  const log = state.habitLog[date] ?? {};
  const list = habitsForDay(state, date);
  const { today } = useNow();
  const future = date > today;

  if (!list.length) {
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
            <span className="emo">{h.emoji}</span>
            <span className="grow">
              <div className="name">{h.name}</div>
              <div className="tgt">{h.target}{h.days ? ` · ${h.days.map((d) => JOURS_LETTRE[d]).join(' ')}` : ''}</div>
            </span>
            <span className={`check ${done ? 'on' : ''}`}><Check size={18} strokeWidth={3} /></span>
          </button>
        );
      })}
      {future && <p className="small muted" style={{ textAlign: 'center' }}>Jour à venir : les cases se cocheront le jour même.</p>}
    </div>
  );
}

function DayView({ initial }: { initial: ISODate }) {
  const { today } = useNow();
  const state = useAppState();
  const [date, setDate] = useState(initial);
  const { done, total } = dayScore(state, date);
  const p = challengeProgress(state, today);
  const { startDate, endDate } = state.challenge;
  const isToday = date === today;

  return (
    <>
      <div className="hero">
        <div className="row" style={{ alignItems: 'center', gap: 16 }}>
          <Ring value={total ? done / total : 0} size={108} stroke={11}>
            <div className="v">{done}/{total}</div>
            <div className="s">validées</div>
          </Ring>
          <div className="grow">
            <div className="muted small">{isToday ? 'Aujourd’hui' : date < today ? 'Correction' : 'À venir'}</div>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 2 }}>{labelDay(date)}</div>
            <div className="row small" style={{ marginTop: 10, gap: 12 }}>
              <span className="row" style={{ gap: 4 }}><Flame size={15} color="#ffb86b" /> {p.currentStreak} j</span>
              <span className="muted">{Math.round(p.rate * 100)} % global</span>
            </div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
          <button className="icon-btn sm" style={{ background: 'rgba(255,255,255,0.08)', color: 'inherit' }} disabled={date <= startDate}
            onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent">
            <ChevronLeft size={18} />
          </button>
          <button className="small" style={{ color: 'inherit', opacity: isToday ? 0.5 : 1 }} disabled={isToday} onClick={() => setDate(minDate(maxDate(today, startDate), endDate))}>
            {isToday ? 'Touchez une habitude pour la valider' : 'Revenir à aujourd’hui'}
          </button>
          <button className="icon-btn sm" style={{ background: 'rgba(255,255,255,0.08)', color: 'inherit' }} disabled={date >= minDate(today, endDate)}
            onClick={() => setDate(addDays(date, 1))} aria-label="Jour suivant">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="section">
        <div className="section-head">
          <h3 className="section-title">Habitudes du jour</h3>
          <span className="link num">{done}/{total}</span>
        </div>
        <HabitChecklist date={date} />
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
        <span><i style={{ background: 'color-mix(in srgb, var(--lime) 45%, var(--surface))' }} /> Partiel</span>
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
                    {inRange && !isFuture && ratio > 0 && <span className="fill" style={{ opacity: full ? 1 : 0.25 + ratio * 0.45 }} />}
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
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="muted small">Progression du challenge</div>
            <div className="big-number" style={{ marginTop: 6 }}>{Math.round((p.dayIndex / p.totalDays) * 100)} %</div>
          </div>
          <div className="muted small" style={{ textAlign: 'right' }}>
            {labelDate(state.challenge.startDate)} → {labelDate(state.challenge.endDate)}<br />
            {remaining} jour{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''}
          </div>
        </div>
        <div className="progress" style={{ marginTop: 14 }}><i style={{ width: `${(p.dayIndex / p.totalDays) * 100}%` }} /></div>
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
