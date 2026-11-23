import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, ListTodo, PieChart, Plus, Settings, Snowflake, Sparkles } from 'lucide-react';
import { Sheet, UIContext, type Modal } from './components/ui';
import { useApp } from './lib/store';
import AgendaScreen from './screens/AgendaScreen';
import { CategoryEditor, ChallengeEditor, HabitDaySheet, HabitEditor } from './screens/Editors';
import ItemEditor from './screens/ItemEditor';
import SettingsScreen from './screens/SettingsScreen';
import StatsScreen from './screens/StatsScreen';
import WinterArcScreen from './screens/WinterArcScreen';

type Tab = 'agenda' | 'stats' | 'arc' | 'reglages';
const TABS: Tab[] = ['agenda', 'stats', 'arc', 'reglages'];

function tabFromHash(): Tab {
  const h = window.location.hash.replace('#', '') as Tab;
  return TABS.includes(h) ? h : 'agenda';
}

function useTheme() {
  const pref = useApp((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = pref === 'system' ? (mq.matches ? 'dark' : 'light') : pref;
      document.documentElement.dataset.theme = t;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#090c12' : '#f8efec');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
}

function CreateSheet({ onPick, onClose }: { onPick: (m: Modal) => void; onClose: () => void }) {
  const actions = [
    { icon: <CalendarPlus size={22} />, bg: 'rgba(61,123,255,0.18)', fg: '#5b8fff', t: 'Créneau', d: 'Un rendez-vous ou un bloc de temps dans l’agenda', m: { type: 'item', preset: { kind: 'event' } } as Modal },
    { icon: <ListTodo size={22} />, bg: 'rgba(217,89,38,0.18)', fg: '#ff8a5c', t: 'Tâche', d: 'À faire un jour donné, avec ou sans horaire', m: { type: 'item', preset: { kind: 'task' } } as Modal },
    { icon: <Sparkles size={22} />, bg: 'rgba(212,245,122,0.2)', fg: 'var(--lime)', t: 'Habitude', d: 'À suivre chaque jour du Winter Arc', m: { type: 'habit' } as Modal },
  ];
  return (
    <Sheet title="Créer" onClose={onClose}>
      <div className="action-list">
        {actions.map((a) => (
          <button key={a.t} className="action" onClick={() => onPick(a.m)}>
            <span className="ic" style={{ background: a.bg, color: a.fg }}>{a.icon}</span>
            <span>
              <div className="t">{a.t}</div>
              <div className="d">{a.d}</div>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export default function App() {
  useTheme();
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => {
    if (t === tab) return;
    history.replaceState(null, '', `#${t}`);
    setTab(t);
  };

  const showToast = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const ui = useMemo(() => ({ open: setModal, close: () => setModal(null), toast: showToast }), [showToast]);
  const close = () => setModal(null);

  const navItem = (t: Tab, label: string, icon: React.ReactNode) => (
    <button className={`nav-item ${tab === t ? 'on' : ''}`} onClick={() => go(t)} aria-label={label} aria-current={tab === t ? 'page' : undefined}>
      {icon}
      <span className="lbl">{label}</span>
    </button>
  );

  return (
    <UIContext.Provider value={ui}>
      <div className="app">
        {tab === 'agenda' && <AgendaScreen />}
        {tab === 'stats' && <StatsScreen />}
        {tab === 'arc' && <WinterArcScreen />}
        {tab === 'reglages' && <SettingsScreen />}

        <nav className="nav" aria-label="Navigation principale">
          {navItem('agenda', 'Agenda', <CalendarDays size={21} />)}
          {navItem('stats', 'Stats', <PieChart size={21} />)}
          <button className="fab" onClick={() => setModal({ type: 'create' })} aria-label="Créer un créneau, une tâche ou une habitude">
            <Plus size={28} strokeWidth={2.5} />
          </button>
          {navItem('arc', 'Winter Arc', <Snowflake size={21} />)}
          {navItem('reglages', 'Réglages', <Settings size={21} />)}
        </nav>

        {modal?.type === 'create' && <CreateSheet onClose={close} onPick={(m) => setModal(m)} />}
        {modal?.type === 'item' && <ItemEditor key={modal.id ?? 'new'} id={modal.id} preset={modal.preset} onClose={close} />}
        {modal?.type === 'habit' && <HabitEditor id={modal.id} onClose={close} />}
        {modal?.type === 'challenge' && <ChallengeEditor onClose={close} />}
        {modal?.type === 'category' && <CategoryEditor id={modal.id} onClose={close} />}
        {modal?.type === 'habitDay' && <HabitDaySheet date={modal.date} onClose={close} />}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </UIContext.Provider>
  );
}
