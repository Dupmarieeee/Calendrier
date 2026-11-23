import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, Snowflake } from 'lucide-react';
import { useUI } from '../components/ui';
import {
  addDays, formatDuration, isoWeek, JOURS, JOURS_COURTS, labelRange, startOfWeek, weekDays,
} from '../lib/dates';
import { dayScore, weekStats } from '../lib/stats';
import { useApp } from '../lib/store';
import type { AppState } from '../lib/types';
import { useNow } from '../useNow';

/** Anneau segmenté par catégorie (2 px d'espace entre segments). */
function Donut({ parts, size = 132, stroke = 16 }: { parts: { color: string; value: number; label: string }[]; size?: number; stroke?: number }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = parts.length > 1 ? 3 : 0;
  let acc = 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flex: 'none' }} role="img"
      aria-label={parts.map((p) => `${p.label} ${formatDuration(p.value)}`).join(', ') || 'Aucun créneau'}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
      {total > 0 && parts.map((p) => {
        const len = (p.value / total) * c;
        const el = (
          <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke}
            strokeDasharray={`${Math.max(0.5, len - gap)} ${c}`} strokeDashoffset={-acc}>
            <title>{`${p.label} : ${formatDuration(p.value)}`}</title>
          </circle>
        );
        acc += len;
        return el;
      })}
    </svg>
  );
}

export default function StatsScreen() {
  const ui = useUI();
  const { today } = useNow();
  const items = useApp((s) => s.items);
  const categories = useApp((s) => s.categories);
  const habits = useApp((s) => s.habits);
  const habitLog = useApp((s) => s.habitLog);
  const challenge = useApp((s) => s.challenge);
  const [ws, setWs] = useState(() => startOfWeek(today));
  const [sel, setSel] = useState<number | null>(null);

  const state = { items, categories } as AppState;
  const days = useMemo(() => weekDays(ws), [ws]);
  const stats = useMemo(() => weekStats(state, days), [items, categories, days]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => weekStats(state, weekDays(addDays(ws, -7))), [items, categories, ws]); // eslint-disable-line react-hooks/exhaustive-deps
  const diff = stats.totalMinutes - prev.totalMinutes;
  const maxDay = Math.max(60, ...stats.perDay);

  const arc = useMemo(() => {
    const st = { habits, habitLog, challenge } as AppState;
    let done = 0;
    let total = 0;
    for (const d of days) {
      if (d > today) continue;
      const s = dayScore(st, d);
      done += s.done;
      total += s.total;
    }
    return { done, total };
  }, [habits, habitLog, challenge, days, today]);

  const isCurrent = ws === startOfWeek(today);

  return (
    <div className="screen">
      <div className="headbar">
        <button className="icon-btn" onClick={() => { setWs(addDays(ws, -7)); setSel(null); }} aria-label="Semaine précédente"><ChevronLeft size={20} /></button>
        <button className="grow when" style={{ textAlign: 'left' }} onClick={() => { setWs(startOfWeek(today)); setSel(null); }}>
          Semaine {isoWeek(ws)} · {labelRange(days[0], days[6])}{isCurrent ? '' : ' ↺'}
        </button>
        <button className="icon-btn" onClick={() => { setWs(addDays(ws, 7)); setSel(null); }} aria-label="Semaine suivante"><ChevronRight size={20} /></button>
      </div>

      <h1 className="display">Où passe<br />mon temps</h1>

      <div className="hero">
        <div className="hero-title">
          <span>Temps planifié</span>
          <span className="small muted" style={{ fontWeight: 500 }}>
            {prev.totalMinutes || stats.totalMinutes ? `${diff >= 0 ? '+' : '−'}${formatDuration(Math.abs(diff))} vs S-1` : ''}
          </span>
        </div>
        <div className="hero-split">
          <div className="ring-wrap" style={{ width: 124, height: 124 }}>
            <Donut parts={stats.totals.map((t) => ({ color: t.category.color, value: t.minutes, label: t.category.name }))} size={124} stroke={13} />
            <div className="ring-label">
              <div className="v" style={{ fontSize: 19 }}>{formatDuration(stats.totalMinutes)}</div>
              <div className="s">au total</div>
            </div>
          </div>
          <span className="divider" />
          <div className="stat-list">
            {stats.totals.length === 0 && <div className="small muted">Aucun créneau horaire cette semaine.</div>}
            {[...stats.totals].sort((x, y) => y.minutes - x.minutes).slice(0, 3).map((t) => (
              <div key={t.category.id} className="stat">
                <span className="ic"><span style={{ width: 10, height: 10, borderRadius: 3, background: t.category.color }} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="v">{formatDuration(t.minutes)}</div>
                  <div className="l" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.category.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3 className="section-title">Par catégorie</h3><span className="link">heures · part</span></div>
        <div className="card" style={{ padding: '4px 16px' }}>
          {stats.totals.length === 0 && (
            <div className="empty">
              <div className="t">Rien de planifié</div>
              <div className="small">Ajoutez des créneaux avec une heure de début et de fin dans l’agenda.</div>
              <button className="btn sm primary" style={{ marginTop: 12 }} onClick={() => ui.open({ type: 'item', preset: { date: days[0] > today ? days[0] : today } })}>Planifier un créneau</button>
            </div>
          )}
          {stats.totals.map((t) => {
            const pct = stats.totalMinutes ? t.minutes / stats.totalMinutes : 0;
            return (
              <div key={t.category.id} className="legend-row">
                <span className="sw" style={{ background: t.category.color }} />
                <span>{t.category.name}</span>
                <span className="v">{formatDuration(t.minutes)}<small>{Math.round(pct * 100)} %</small></span>
                <span className="bar"><i style={{ width: `${pct * 100}%`, background: t.category.color }} /></span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3 className="section-title">Jour par jour</h3><span className="link">touchez une barre</span></div>
        <div className="card">
          <div className="bars" role="img" aria-label="Temps planifié par jour">
            {days.map((d, i) => (
              <button key={d} className={`b ${sel === i ? 'on' : ''}`} onClick={() => setSel(sel === i ? null : i)} aria-label={`${JOURS[i]} : ${formatDuration(stats.perDay[i])}`}>
                {stats.perDay[i] === 0 ? <span className="empty" /> : stats.totals.map((t) => t.perDay[i] > 0 && (
                  <span key={t.category.id} className="seg" style={{ height: `${(t.perDay[i] / maxDay) * 100}%`, background: t.category.color, opacity: sel === null || sel === i ? 1 : 0.35 }} />
                ))}
              </button>
            ))}
          </div>
          <div className="bars-x">
            {days.map((d, i) => (
              <button key={d} className={sel === i ? 'on' : ''} onClick={() => setSel(sel === i ? null : i)}>
                {JOURS_COURTS[i]}
                <div className="num" style={{ fontWeight: 500 }}>{stats.perDay[i] ? `${Math.floor(stats.perDay[i] / 60)}h${String(stats.perDay[i] % 60).padStart(2, '0')}` : '–'}</div>
              </button>
            ))}
          </div>
          {sel !== null && (
            <div className="tip">
              <strong>{JOURS[sel]} · {formatDuration(stats.perDay[sel])}</strong>
              {stats.totals.filter((t) => t.perDay[sel] > 0).map((t) => (
                <div key={t.category.id} className="row" style={{ marginTop: 6 }}>
                  <span className="dot" style={{ width: 9, height: 9, borderRadius: 3, background: t.category.color, display: 'inline-block' }} />
                  <span className="grow">{t.category.name}</span>
                  <span className="num">{formatDuration(t.perDay[sel])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {stats.untimedCount > 0 && (
        <div className="notice row" style={{ marginTop: 12, gap: 10 }}>
          <Info size={16} style={{ flex: 'none' }} />
          <span>{stats.untimedCount} tâche{stats.untimedCount > 1 ? 's' : ''} sans créneau horaire cette semaine : affichée{stats.untimedCount > 1 ? 's' : ''} dans l’agenda, non comptée{stats.untimedCount > 1 ? 's' : ''} ici.</span>
        </div>
      )}

      {arc.total > 0 && (
        <div className="card row" style={{ marginTop: 12, gap: 12 }}>
          <span className="icon-btn sm" style={{ background: 'color-mix(in srgb, var(--lime) 20%, var(--surface))' }}><Snowflake size={17} /></span>
          <div className="grow">
            <div className="ttl">{challenge.name} cette semaine</div>
            <div className="tiny muted">{arc.done}/{arc.total} habitudes validées</div>
          </div>
          <strong className="num">{Math.round((arc.done / arc.total) * 100)} %</strong>
        </div>
      )}
    </div>
  );
}
