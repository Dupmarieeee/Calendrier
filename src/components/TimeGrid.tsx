import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ListChecks, Repeat, StickyNote } from 'lucide-react';
import { formatHour, fromMinutes, JOURS_COURTS, parseISO, slotMinutes, toMinutes } from '../lib/dates';
import type { Item, ISODate } from '../lib/types';
import { GoogleMark, vibrate } from './ui';

interface Props {
  days: ISODate[];
  items: Item[];
  rich: boolean;
  hourHeight: number;
  today: ISODate;
  nowMinutes: number;
  colorOf: (it: Item) => string;
  onOpen: (id: string) => void;
  onCreate: (date: ISODate, minutes: number) => void;
  onCommit: (id: string, patch: { date: ISODate; start: string; end: string }) => void;
  onToggleDone: (id: string) => void;
  onPickDay?: (d: ISODate) => void;
  top?: ReactNode;
}

interface DragState {
  id: string;
  mode: 'move' | 'resize';
  pointerType: string;
  x0: number;
  y0: number;
  scroll0: number;
  active: boolean;
  timer?: ReturnType<typeof setTimeout>;
  dayIdx: number;
  start: number;
  end: number; // minutes, peut dépasser 1440 si fin le lendemain
  colW: number;
  lastY: number;
  view?: { date: ISODate; start: number; end: number };
}

const SNAP = 15;
const LONG_PRESS = 350;

/** Répartit les créneaux qui se chevauchent en colonnes. */
function layout(list: { id: string; s: number; e: number }[]) {
  const out = new Map<string, { col: number; cols: number }>();
  const sorted = [...list].sort((a, b) => a.s - b.s || b.e - a.e);
  let cluster: { id: string; col: number }[] = [];
  let colsEnd: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const c of cluster) out.set(c.id, { col: c.col, cols: colsEnd.length });
    cluster = [];
    colsEnd = [];
  };
  for (const it of sorted) {
    if (it.s >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    let col = colsEnd.findIndex((end) => end <= it.s);
    if (col < 0) {
      col = colsEnd.length;
      colsEnd.push(it.e);
    } else colsEnd[col] = it.e;
    cluster.push({ id: it.id, col });
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  flush();
  return out;
}

export default function TimeGrid(p: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<DragState['view'] & { id: string } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const handlers = useRef<{ onMove: (e: PointerEvent) => void; onUp: () => void; onCancel: () => void }>(null!);
  const stable = useMemo(() => ({
    move: (e: PointerEvent) => handlers.current.onMove(e),
    up: () => handlers.current.onUp(),
    cancel: () => handlers.current.onCancel(),
  }), []);
  const hh = p.hourHeight;
  const dayH = hh * 24;
  const n = p.days.length;

  // Position de défilement initiale : un peu avant maintenant (ou 7 h)
  const firstDay = p.days[0];
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const showsToday = p.days.includes(p.today);
    const target = showsToday ? Math.max(0, p.nowMinutes - 90) : 7 * 60 - 20;
    el.scrollTop = (target / 60) * hh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDay, n, hh]);

  // Empêche le défilement pendant un glisser-déposer (iOS)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (dragRef.current?.active) e.preventDefault();
    };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  const timed = useMemo(() => p.items.filter((i) => i.start && i.end), [p.items]);
  const untimed = useMemo(() => p.items.filter((i) => !i.start), [p.items]);

  const byDay = useMemo(() => {
    const m = new Map<ISODate, Item[]>(p.days.map((d) => [d, []]));
    for (const it of timed) {
      if (drag && it.id === drag.id) continue;
      m.get(it.date)?.push(it);
    }
    if (drag) {
      const it = timed.find((i) => i.id === drag.id);
      if (it) m.get(drag.date)?.push({ ...it, date: drag.date, start: fromMinutes(drag.start), end: fromMinutes(Math.min(drag.end, 1440)) });
    }
    return m;
  }, [timed, p.days, drag]);

  // ---------------------------------------------------------------- Glisser-déposer
  function computeView(st: DragState, clientX: number, clientY: number) {
    const el = scrollRef.current!;
    const dy = clientY - st.y0 + (el.scrollTop - st.scroll0);
    const dx = clientX - st.x0;
    const dMin = Math.round(((dy / hh) * 60) / SNAP) * SNAP;
    const dur = st.end - st.start;
    if (st.mode === 'resize') {
      const end = Math.max(st.start + SNAP, Math.min(1440, st.end + dMin));
      return { date: p.days[st.dayIdx], start: st.start, end };
    }
    const dDay = n > 1 ? Math.round(dx / st.colW) : 0;
    const dayIdx = Math.max(0, Math.min(n - 1, st.dayIdx + dDay));
    const start = Math.max(0, Math.min(1440 - Math.min(dur, 1440), st.start + dMin));
    return { date: p.days[dayIdx], start, end: start + dur };
  }

  function activate(st: DragState) {
    st.active = true;
    vibrate(12);
    setArmed(null);
    st.view = { date: p.days[st.dayIdx], start: st.start, end: st.end };
    setDrag({ id: st.id, ...st.view });
  }

  function cleanup() {
    const st = dragRef.current;
    if (st?.timer) clearTimeout(st.timer);
    dragRef.current = null;
    window.removeEventListener('pointermove', stable.move);
    window.removeEventListener('pointerup', stable.up);
    window.removeEventListener('pointercancel', stable.cancel);
    setArmed(null);
  }

  function onMove(e: PointerEvent) {
    const st = dragRef.current;
    if (!st) return;
    st.lastY = e.clientY;
    const dist = Math.hypot(e.clientX - st.x0, e.clientY - st.y0);
    if (!st.active) {
      if (st.pointerType === 'mouse' ? dist > 4 : dist > 9) {
        if (st.pointerType === 'mouse') activate(st);
        else return cleanup(); // l'utilisateur fait défiler
      } else return;
    }
    e.preventDefault();
    // Défilement automatique près des bords
    const el = scrollRef.current!;
    const r = el.getBoundingClientRect();
    if (e.clientY < r.top + 60) el.scrollTop -= 12;
    else if (e.clientY > r.bottom - 120) el.scrollTop += 12;
    const v = computeView(st, e.clientX, e.clientY);
    if (!st.view || v.date !== st.view.date || v.start !== st.view.start || v.end !== st.view.end) {
      if (st.view && (v.start !== st.view.start || v.date !== st.view.date || v.end !== st.view.end)) vibrate(4);
      st.view = v;
      setDrag({ id: st.id, ...v });
    }
  }

  function onUp() {
    const st = dragRef.current;
    if (st?.active && st.view) {
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 350);
      const it = timed.find((i) => i.id === st.id);
      const v = st.view;
      if (it && (v.date !== it.date || v.start !== st.start || v.end !== st.end)) {
        p.onCommit(st.id, { date: v.date, start: fromMinutes(v.start), end: fromMinutes(v.end >= 1440 ? 1440 : v.end) });
      }
    }
    setDrag(null);
    cleanup();
  }

  function onCancel() {
    setDrag(null);
    cleanup();
  }

  function onPointerDown(e: React.PointerEvent, it: Item, mode: 'move' | 'resize') {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (it.g?.readOnly) return;
    e.stopPropagation();
    cleanup();
    const colW = (colsRef.current?.getBoundingClientRect().width ?? 300) / n;
    const s = toMinutes(it.start!);
    const st: DragState = {
      id: it.id,
      mode,
      pointerType: e.pointerType,
      x0: e.clientX,
      y0: e.clientY,
      scroll0: scrollRef.current?.scrollTop ?? 0,
      active: false,
      dayIdx: p.days.indexOf(it.date),
      start: s,
      end: s + slotMinutes(it.start!, it.end!),
      colW,
      lastY: e.clientY,
    };
    dragRef.current = st;
    if (e.pointerType !== 'mouse') {
      setArmed(it.id);
      st.timer = setTimeout(() => {
        if (dragRef.current === st) activate(st);
      }, LONG_PRESS);
    }
    window.addEventListener('pointermove', stable.move, { passive: false });
    window.addEventListener('pointerup', stable.up);
    window.addEventListener('pointercancel', stable.cancel);
  }

  // Gestionnaires stables (ajoutés sur window) qui appellent la version à jour.
  handlers.current = { onMove, onUp, onCancel };

  useEffect(() => cleanup, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- Rendu
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  const showsToday = p.days.includes(p.today);
  const nowTop = (p.nowMinutes / 60) * hh;

  return (
    <div className="grid-scroll" ref={scrollRef}>
      {!p.rich && (
        <div className="grid-header">
          <div className="gutter" />
          <div className="cols" style={cols}>
            {p.days.map((d, i) => (
              <button key={d} className={`colhead ${d === p.today ? 'today' : ''}`} onClick={() => p.onPickDay?.(d)} aria-label={`Voir le ${d}`}>
                <span className="wd">{JOURS_COURTS[i]}</span>
                <span className="dn num">{parseISO(d).d}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!p.rich && untimed.length > 0 && (
        <div className="allday">
          <div className="gutter">sans<br />horaire</div>
          <div className="cols" style={cols}>
            {p.days.map((d) => {
              const list = untimed.filter((i) => i.date === d || (i.endDate && i.date <= d && i.endDate >= d));
              return (
                <div className="cell" key={d}>
                  {list.slice(0, 3).map((it) => (
                    <button key={it.id} className={`adchip ${it.done ? 'done' : ''}`} style={{ ['--c' as any]: p.colorOf(it) }} onClick={() => p.onOpen(it.id)}>
                      {it.title}
                    </button>
                  ))}
                  {list.length > 3 && (
                    <button className="adchip" style={{ ['--c' as any]: 'var(--text-3)' }} onClick={() => p.onPickDay?.(d)}>
                      +{list.length - 3}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {p.top}
      <div className="grid-body" style={{ height: dayH + 16, paddingTop: 8 }}>
        <div className="hours" style={{ height: dayH }}>
          {Array.from({ length: 24 }, (_, h) => (h === 0 ? null : (
            <span key={h} style={{ top: h * hh }}>{`${h}:00`}</span>
          )))}
          {showsToday && <span className="nowbadge" style={{ top: nowTop }}>{formatHour(fromMinutes(p.nowMinutes))}</span>}
        </div>
        <div className="cols-body" ref={colsRef} style={{ ...cols, height: dayH }}>
          {p.days.map((d) => {
            const list = byDay.get(d) ?? [];
            const lay = layout(list.map((it) => {
              const s = toMinutes(it.start!);
              return { id: it.id, s, e: Math.min(1440, s + Math.max(slotMinutes(it.start!, it.end!), 20)) };
            }));
            return (
              <div
                key={d}
                className={`col ${d === p.today && n > 1 ? 'today' : ''}`}
                onClick={(e) => {
                  if (suppressClick.current || e.target !== e.currentTarget) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  const min = Math.floor((((e.clientY - r.top) / hh) * 60) / 30) * 30;
                  p.onCreate(d, Math.max(0, Math.min(1410, min)));
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="hline" style={{ top: h * hh }} />
                ))}
                {p.rich && Array.from({ length: 24 }, (_, h) => <div key={`h${h}`} className="hline half" style={{ top: h * hh + hh / 2 }} />)}
                {list.map((it) => {
                  const s = toMinutes(it.start!);
                  const dur = slotMinutes(it.start!, it.end!);
                  const top = (s / 60) * hh;
                  const height = Math.max(p.rich ? 30 : 20, (Math.min(dur, 1440 - s) / 60) * hh - 2);
                  const l = lay.get(it.id) ?? { col: 0, cols: 1 };
                  const w = 100 / l.cols;
                  const isDrag = drag?.id === it.id;
                  const doneSub = it.subtasks.filter((x) => x.done).length;
                  return (
                    <div
                      key={it.id}
                      role="button"
                      tabIndex={0}
                      className={`ev ${p.rich ? 'rich' : ''} ${it.done ? 'done' : ''} ${isDrag ? 'dragging' : ''} ${armed === it.id ? 'armed' : ''}`}
                      style={{
                        ['--c' as any]: p.colorOf(it),
                        top,
                        height,
                        left: `calc(${l.col * w}% + 2px)`,
                        width: `calc(${w}% - 4px)`,
                        right: 'auto',
                      }}
                      onPointerDown={(e) => onPointerDown(e, it, 'move')}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (suppressClick.current) return;
                        p.onOpen(it.id);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && p.onOpen(it.id)}
                    >
                      <div className="row" style={{ alignItems: 'flex-start', gap: 6 }}>
                        <div className="grow">
                          <div className="t">{it.title}</div>
                          {(p.rich || height > 34) && (
                            <div className="h">
                              {formatHour(it.start!)}{p.rich || l.cols === 1 ? ` – ${formatHour(it.end!)}` : ''}
                            </div>
                          )}
                        </div>
                        {p.rich && it.kind === 'task' && (
                          <button
                            className={`check ${it.done ? 'on' : ''}`}
                            aria-label={it.done ? 'Marquer comme à faire' : 'Marquer comme faite'}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              p.onToggleDone(it.id);
                            }}
                          >
                            <Check size={15} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                      {p.rich && height > 62 && (
                        <div className="meta">
                          {it.subtasks.length > 0 && (
                            <span className="row" style={{ gap: 4 }}><ListChecks size={13} /> {doneSub}/{it.subtasks.length}</span>
                          )}
                          {it.notes && <StickyNote size={13} />}
                          {(it.seriesId || it.g?.recurringEventId) && <Repeat size={13} />}
                          {it.g && <GoogleMark size={12} />}
                        </div>
                      )}
                      {p.rich && height > 44 && !it.g?.readOnly && <div className="grip" />}
                      {!it.g?.readOnly && (
                        <div className="resize-zone" onPointerDown={(e) => onPointerDown(e, it, 'resize')} />
                      )}
                    </div>
                  );
                })}
                {d === p.today && <div className="nowline" style={{ top: nowTop }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
