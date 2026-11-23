import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { ChoiceSheet, Segmented, Sheet, useUI } from '../components/ui';
import {
  CATEGORY_COLORS, deleteCategory, deleteHabit, HABIT_COLORS, newId, upsertCategory, upsertHabit,
} from '../lib/actions';
import { addDays, diffDays, JOURS_LETTRE, labelDay, maxDate, todayParis } from '../lib/dates';
import { dayScore } from '../lib/stats';
import { store, update, useApp } from '../lib/store';
import type { Habit } from '../lib/types';
import { HabitChecklist } from './WinterArcScreen';

const EMOJIS = ['👟', '💧', '💊', '🏋️', '🧘', '📚', '🥗', '😴', '🧊', '🚶', '🏃', '✍️', '🚭', '☀️', '🎯', '🧠'];

export function HabitEditor({ id, onClose }: { id?: string; onClose: () => void }) {
  const ui = useUI();
  const existing = useApp((s) => s.habits.find((h) => h.id === id));
  const challenge = useApp((s) => s.challenge);
  const habitsCount = useApp((s) => s.habits.length);
  const [h, setH] = useState<Habit>(() => existing ?? {
    id: newId(),
    name: '',
    emoji: '🎯',
    color: HABIT_COLORS[habitsCount % HABIT_COLORS.length],
    target: '',
    days: null,
    since: maxDate(challenge.startDate, todayParis()),
    createdAt: Date.now(),
  });
  const [confirm, setConfirm] = useState(false);
  const set = (p: Partial<Habit>) => setH((x) => ({ ...x, ...p }));

  function save() {
    if (!h.name.trim()) return ui.toast('Donnez un nom à l’habitude');
    update((s) => upsertHabit(s, { ...h, name: h.name.trim(), target: h.target.trim() }));
    onClose();
  }

  return (
    <>
      <Sheet
        title={existing ? 'Modifier l’habitude' : 'Nouvelle habitude'}
        onClose={onClose}
        onConfirm={save}
        footer={
          <>
            {existing && <button className="btn danger" aria-label="Supprimer" onClick={() => setConfirm(true)}><Trash2 size={18} /></button>}
            <button className="btn primary grow" onClick={save}><Check size={18} /> {existing ? 'Enregistrer' : 'Ajouter'}</button>
          </>
        }
      >
        <div className="row" style={{ gap: 12 }}>
          <span className="emo-badge" style={{ ['--c' as any]: h.color }}>{h.emoji}</span>
          <input className="input grow" placeholder="Nom (ex. Marcher)" value={h.name} autoFocus={!existing} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <label className="field">
          <span className="label">Objectif</span>
          <input className="input" placeholder="ex. 12 000 pas, 2,5 L, 5 g…" value={h.target} onChange={(e) => set({ target: e.target.value })} />
        </label>
        <div className="field">
          <span className="label">Icône</span>
          <div className="swatches">
            {EMOJIS.map((e) => (
              <button key={e} className={`swatch ${h.emoji === e ? 'on' : ''}`} style={{ background: 'var(--surface-2)', fontSize: 18 }} onClick={() => set({ emoji: e })}>{e}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">Couleur</span>
          <div className="swatches">
            {HABIT_COLORS.map((c) => (
              <button key={c} className={`swatch ${h.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ color: c })} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">Fréquence</span>
          <Segmented<'all' | 'some'>
            value={h.days ? 'some' : 'all'}
            onChange={(v) => set({ days: v === 'all' ? null : [0, 2, 4] })}
            options={[{ value: 'all', label: 'Tous les jours' }, { value: 'some', label: 'Certains jours' }]}
          />
          {h.days && (
            <div className="daypick" style={{ marginTop: 10 }}>
              {JOURS_LETTRE.map((l, i) => (
                <button key={i} className={h.days!.includes(i) ? 'on' : ''}
                  onClick={() => {
                    const days = h.days!.includes(i) ? h.days!.filter((x) => x !== i) : [...h.days!, i].sort();
                    if (days.length) set({ days });
                  }}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="card row" style={{ marginTop: 14, padding: '6px 14px' }}>
          <div className="grow">
            <div className="ttl">Suivie depuis le</div>
            <div className="tiny muted">Les jours précédents ne comptent pas dans le taux de réussite</div>
          </div>
          <input type="date" className="input" style={{ width: 'auto', minHeight: 40, padding: '8px 12px' }} min={challenge.startDate} max={challenge.endDate}
            value={h.since} onChange={(e) => e.target.value && set({ since: e.target.value })} />
        </div>
      </Sheet>
      {confirm && (
        <ChoiceSheet
          title="Supprimer l’habitude ?"
          message="Elle disparaîtra du suivi et des statistiques."
          onClose={() => setConfirm(false)}
          choices={[{ label: 'Supprimer', danger: true, onPick: () => { update((s) => deleteHabit(s, h.id)); onClose(); } }]}
        />
      )}
    </>
  );
}

export function ChallengeEditor({ onClose }: { onClose: () => void }) {
  const ui = useUI();
  const challenge = useApp((s) => s.challenge);
  const [c, setC] = useState(challenge);
  const days = diffDays(c.endDate, c.startDate) + 1;

  function save() {
    if (c.endDate < c.startDate) return ui.toast('La fin doit être après le début');
    update((s) => ({
      ...s,
      challenge: { ...c, name: c.name.trim() || 'Winter Arc' },
      // Une habitude ne peut pas commencer avant le challenge
      habits: s.habits.map((h) => (h.since < c.startDate ? { ...h, since: c.startDate } : h)),
    }));
    onClose();
  }

  return (
    <Sheet title="Mon challenge" onClose={onClose} onConfirm={save} footer={<button className="btn primary grow" onClick={save}><Check size={18} /> Enregistrer</button>}>
      <label className="field">
        <span className="label">Nom</span>
        <input className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
      </label>
      <div className="two">
        <label className="field">
          <span className="label">Début</span>
          <input type="date" className="input" value={c.startDate} onChange={(e) => e.target.value && setC({ ...c, startDate: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">Fin</span>
          <input type="date" className="input" value={c.endDate} min={c.startDate} onChange={(e) => e.target.value && setC({ ...c, endDate: e.target.value })} />
        </label>
      </div>
      <p className="small muted" style={{ margin: '12px 4px' }}>{days > 0 ? `${days} jours de challenge.` : 'Dates invalides.'}</p>
      <div className="chips">
        {[30, 60, 90, 100].map((n) => (
          <button key={n} className={`chip ${days === n ? 'on' : ''}`} onClick={() => setC({ ...c, endDate: addDays(c.startDate, n - 1) })}>{n} jours</button>
        ))}
      </div>
    </Sheet>
  );
}

export function CategoryEditor({ id, onClose }: { id?: string; onClose: () => void }) {
  const existing = useApp((s) => s.categories.find((c) => c.id === id));
  const count = useApp((s) => s.categories.length);
  const used = useApp((s) => (id ? Object.values(s.items).filter((i) => i.categoryId === id).length : 0));
  const [c, setC] = useState(() => existing ?? { id: `cat-${newId().slice(0, 10)}`, name: '', color: CATEGORY_COLORS[count % CATEGORY_COLORS.length] });
  const [confirm, setConfirm] = useState(false);

  function save() {
    if (!c.name.trim()) return;
    update((s) => upsertCategory(s, { ...c, name: c.name.trim() }));
    onClose();
  }

  return (
    <>
      <Sheet
        title={existing ? 'Catégorie' : 'Nouvelle catégorie'}
        onClose={onClose}
        onConfirm={save}
        footer={
          <>
            {existing && <button className="btn danger" aria-label="Supprimer" onClick={() => setConfirm(true)}><Trash2 size={18} /></button>}
            <button className="btn primary grow" onClick={save}><Check size={18} /> Enregistrer</button>
          </>
        }
      >
        <label className="field">
          <span className="label">Nom</span>
          <input className="input" value={c.name} placeholder="ex. Déplacements" autoFocus={!existing} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </label>
        <div className="field">
          <span className="label">Couleur (agenda et statistiques)</span>
          <div className="swatches">
            {CATEGORY_COLORS.map((col) => (
              <button key={col} className={`swatch ${c.color === col ? 'on' : ''}`} style={{ background: col }} onClick={() => setC({ ...c, color: col })} aria-label={col} />
            ))}
            <label className={`swatch ${CATEGORY_COLORS.includes(c.color) ? '' : 'on'}`} style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', position: 'relative', overflow: 'hidden' }} aria-label="Couleur personnalisée">
              <input type="color" value={c.color} onChange={(e) => setC({ ...c, color: e.target.value })} style={{ position: 'absolute', inset: 0, opacity: 0 }} />
            </label>
          </div>
        </div>
        <div className="chip" style={{ marginTop: 18 }}><span className="dot" style={{ background: c.color }} /> {c.name || 'Aperçu'}</div>
      </Sheet>
      {confirm && (
        <ChoiceSheet
          title="Supprimer la catégorie ?"
          message={used ? `${used} élément(s) passeront en « Sans catégorie ».` : undefined}
          onClose={() => setConfirm(false)}
          choices={[{ label: 'Supprimer', danger: true, onPick: () => { update((s) => deleteCategory(s, c.id)); onClose(); } }]}
        />
      )}
    </>
  );
}

export function HabitDaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const [initial] = useState(() => dayScore(store.get(), date).done);
  useApp((s) => s.habitLog); // rafraîchit le compteur
  const live = dayScore(store.get(), date);
  return (
    <Sheet title={labelDay(date)} onClose={onClose}>
      <p className="small muted" style={{ margin: '0 4px 12px', textAlign: 'center' }}>
        {live.done}/{live.total} habitudes validées{initial !== live.done ? ' · corrigé ✓' : ''}
      </p>
      <HabitChecklist date={date} />
    </Sheet>
  );
}
