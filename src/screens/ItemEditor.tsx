import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Clock, Clock4, ExternalLink, Hourglass, Lock, Plus, Repeat, Trash2, X } from 'lucide-react';
import { ChoiceSheet, GoogleMark, Segmented, Sheet, Switch, useUI, type ItemPreset } from '../components/ui';
import {
  CATEGORY_COLORS, createItem, deleteItem, isRecurring, newId, setItemSync, updateItem, upsertCategory,
  type ItemDraft, type RepeatDraft, type Scope,
} from '../lib/actions';
import {
  addDays, addMonths, formatDuration, fromMinutes, JOURS_LETTRE, labelDate, slotMinutes, toMinutes, todayParis, weekday,
} from '../lib/dates';
import { update, useApp } from '../lib/store';
import type { Item, RepeatFreq, Subtask } from '../lib/types';

type RepeatChoice = 'none' | RepeatFreq;

interface Props {
  id?: string;
  preset?: ItemPreset;
  onClose: () => void;
}

const DURATIONS = [30, 60, 90, 120];

export default function ItemEditor({ id, preset, onClose }: Props) {
  const ui = useUI();
  const categories = useApp((s) => s.categories);
  const google = useApp((s) => s.google);
  const challengeEnd = useApp((s) => s.challenge.endDate);
  const existing = useApp((s) => (id ? s.items[id] : undefined));
  const connected = !!google.session;

  const init = useMemo<ItemDraft>(() => {
    if (existing) {
      return {
        kind: existing.kind, title: existing.title, date: existing.date, endDate: existing.endDate,
        start: existing.start, end: existing.end, categoryId: existing.categoryId, notes: existing.notes,
        subtasks: existing.subtasks, done: existing.done, sync: existing.sync,
      };
    }
    const kind = preset?.kind ?? 'event';
    const start = preset?.start !== undefined ? preset.start : kind === 'event' ? '09:00' : null;
    return {
      kind,
      title: '',
      date: preset?.date ?? todayParis(),
      start,
      end: preset?.end ?? (start ? fromMinutes(Math.min(1440, toMinutes(start) + 60)) : null),
      categoryId: categories[0]?.id ?? null,
      notes: '',
      subtasks: [],
      sync: connected && google.defaultSync,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [d, setD] = useState<ItemDraft>(init);
  const [repeat, setRepeat] = useState<RepeatChoice>('none');
  const [repeatDays, setRepeatDays] = useState<number[]>(() => [weekday(init.date)]);
  const [until, setUntil] = useState(() => (challengeEnd > init.date ? challengeEnd : addMonths(init.date, 3)));
  const [newSub, setNewSub] = useState('');
  const [newCat, setNewCat] = useState<{ name: string; color: string } | null>(null);
  const [ask, setAsk] = useState<null | 'save' | 'delete' | 'confirmDelete'>(null);

  const readOnly = !!existing?.g?.readOnly;
  const isGoogle = existing?.origin === 'google';
  const recurring = existing ? isRecurring(existing) : false;
  const set = (p: Partial<ItemDraft>) => setD((x) => ({ ...x, ...p }));
  const calName = existing?.g ? google.calendars.find((c) => c.id === existing.g!.calendarId)?.summary : undefined;

  const hasTime = !!d.start;
  const duration = d.start && d.end ? slotMinutes(d.start, d.end) : 0;
  const crossesMidnight = !!(d.start && d.end && toMinutes(d.end) <= toMinutes(d.start));

  function setStart(v: string) {
    if (!v) return;
    // Conserve la durée lorsqu'on change l'heure de début
    const dur = duration || 60;
    set({ start: v, end: fromMinutes(Math.min(1440, toMinutes(v) + dur)) });
  }

  function addSub() {
    const t = newSub.trim();
    if (!t) return;
    set({ subtasks: [...d.subtasks, { id: newId(), text: t, done: false }] });
    setNewSub('');
  }

  function patchSub(sid: string, p: Partial<Subtask>) {
    set({ subtasks: d.subtasks.map((s) => (s.id === sid ? { ...s, ...p } : s)) });
  }

  function buildPatch(): Partial<Item> {
    const p: Partial<Item> = {};
    const keys: (keyof ItemDraft)[] = ['kind', 'title', 'date', 'endDate', 'start', 'end', 'categoryId', 'notes', 'subtasks', 'done'];
    for (const k of keys) {
      const a = (d as any)[k];
      const b = (existing as any)[k];
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) (p as any)[k] = a;
    }
    if ('title' in p) p.title = (p.title ?? '').trim() || 'Sans titre';
    if (!d.start) {
      p.start = null;
      p.end = null;
    } else if ('endDate' in p) delete p.endDate;
    return p;
  }

  function save(scope?: Scope) {
    if (!existing) {
      const rep: RepeatDraft | undefined = repeat === 'none' ? undefined : { freq: repeat, byDay: repeat === 'weekly' ? repeatDays : undefined, until };
      const draft = { ...d, endDate: d.start ? undefined : d.endDate, sync: connected ? d.sync : false };
      update((s) => createItem(s, draft, rep).state);
      ui.toast(rep ? 'Série créée' : d.kind === 'task' ? 'Tâche créée' : 'Créneau créé');
      onClose();
      return;
    }
    const patch = buildPatch();
    const syncChanged = existing.origin === 'app' && d.sync !== existing.sync;
    const seriesRelevant = ['title', 'notes', 'start', 'end', 'categoryId', 'kind'].some((k) => k in patch);
    if (recurring && seriesRelevant && !scope) {
      setAsk('save');
      return;
    }
    update((s) => {
      let next = Object.keys(patch).length ? updateItem(s, existing.id, patch, scope ?? 'one') : s;
      if (syncChanged) next = setItemSync(next, existing.id, d.sync);
      return next;
    });
    onClose();
  }

  function remove(scope: Scope) {
    if (!existing) return;
    update((s) => deleteItem(s, existing.id, scope));
    ui.toast(scope === 'series' ? 'Série supprimée' : 'Supprimé');
    onClose();
  }

  function addCategory() {
    if (!newCat?.name.trim()) return;
    const cat = { id: `cat-${newId().slice(0, 10)}`, name: newCat.name.trim(), color: newCat.color };
    update((s) => upsertCategory(s, cat));
    set({ categoryId: cat.id });
    setNewCat(null);
  }

  const title = existing ? (d.kind === 'task' ? 'Modifier la tâche' : 'Modifier le créneau') : d.kind === 'task' ? 'Nouvelle tâche' : 'Nouveau créneau';

  return (
    <>
      <Sheet
        title={title}
        onClose={onClose}
        onConfirm={() => save()}
        footer={
          <>
            {existing && !readOnly && (
              <button className="btn danger" onClick={() => setAsk(recurring ? 'delete' : 'confirmDelete')} aria-label="Supprimer">
                <Trash2 size={18} />
              </button>
            )}
            <button className="btn primary grow" onClick={() => save()}>
              {existing ? 'Enregistrer' : d.kind === 'task' ? 'Créer la tâche' : 'Créer le créneau'}
            </button>
          </>
        }
      >
        <Segmented
          value={d.kind}
          onChange={(k) => set(k === 'task' && !existing ? { kind: k, start: null, end: null } : k === 'event' && !d.start ? { kind: k, start: '09:00', end: '10:00' } : { kind: k })}
          options={[{ value: 'event', label: 'Créneau' }, { value: 'task', label: 'Tâche' }]}
        />

        <label className="field">
          <span className="label">Titre</span>
          <input
            className="input"
            placeholder={d.kind === 'task' ? 'ex. Appeler la banque' : 'ex. Séance jambes'}
            value={d.title}
            disabled={readOnly}
            autoFocus={!existing}
            enterKeyHint="done"
            onChange={(e) => set({ title: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="label">Notes {existing?.g || d.sync ? '· synchronisées avec Google' : ''}</span>
          <textarea className="textarea" value={d.notes} disabled={readOnly} placeholder="Détails, lien, adresse…" onChange={(e) => set({ notes: e.target.value })} />
        </label>

        {existing?.g && (
          <div className="notice row" style={{ gap: 10, marginTop: 4 }}>
            <GoogleMark size={16} />
            <div className="grow">
              {isGoogle ? 'Événement Google' : 'Envoyé vers Google'} · <strong>{calName ?? 'Agenda'}</strong>
              {recurring && <span> · <Repeat size={12} /> récurrent</span>}
              {readOnly && <div className="tiny"><Lock size={11} /> Agenda en lecture seule : seules la catégorie, les sous-tâches et la case « faite » sont modifiables.</div>}
            </div>
            {existing.g.htmlLink && (
              <a href={existing.g.htmlLink} target="_blank" rel="noreferrer" className="icon-btn sm" aria-label="Ouvrir dans Google Agenda">
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        )}

        <div className="field">
          <div className="row" style={{ justifyContent: 'space-between', margin: '0 2px 8px' }}>
            <span className="label" style={{ margin: 0 }}>Date et horaire</span>
            <span className="row small muted" style={{ gap: 8 }}>
              Horaire
              <Switch checked={hasTime} disabled={readOnly} label="Horaire" onChange={(v) => set(v ? { start: '09:00', end: '10:00' } : { start: null, end: null })} />
            </span>
          </div>
          <div className={hasTime || d.kind === 'event' ? 'two' : ''}>
            <div className="input-icon">
              <CalendarDays size={17} />
              <input type="date" className="input" value={d.date} disabled={readOnly} aria-label="Date"
                onChange={(e) => e.target.value && set({ date: e.target.value })} />
            </div>
            {!hasTime && d.kind === 'event' && (
              <div className="input-icon">
                <ArrowRight size={17} />
                <input type="date" className="input" min={d.date} value={d.endDate ?? d.date} disabled={readOnly} aria-label="Jusqu’au"
                  onChange={(e) => set({ endDate: e.target.value > d.date ? e.target.value : undefined })} />
              </div>
            )}
            {hasTime && <div className="input-icon"><Hourglass size={17} /><div className="input" style={{ paddingLeft: 42, display: 'flex', alignItems: 'center' }}>{formatDuration(duration)}</div></div>}
          </div>
          {hasTime ? (
            <>
              <div className="two" style={{ marginTop: 10 }}>
                <div className="input-icon">
                  <Clock size={17} />
                  <input type="time" step={300} className="input" value={d.start!} disabled={readOnly} aria-label="Début" onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="input-icon">
                  <Clock4 size={17} />
                  <input type="time" step={300} className="input" value={d.end ?? ''} disabled={readOnly} aria-label="Fin" onChange={(e) => e.target.value && set({ end: e.target.value })} />
                </div>
              </div>
              {crossesMidnight && <p className="tiny muted" style={{ margin: '6px 4px 0' }}>Se termine le lendemain.</p>}
              {!readOnly && (
                <div className="chips" style={{ marginTop: 10 }}>
                  {DURATIONS.map((m) => (
                    <button key={m} className={`chip ${duration === m ? 'on' : ''}`} onClick={() => set({ end: fromMinutes(Math.min(1440, toMinutes(d.start!) + m)) })}>
                      {formatDuration(m)}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="tiny muted" style={{ margin: '8px 4px 0' }}>Sans créneau : affiché dans la journée, non compté dans les statistiques.</p>
          )}
        </div>

        <div className="field">
          <span className="label">Catégorie</span>
          <div className="chips">
            {categories.map((c) => (
              <button key={c.id} className={`tag ${d.categoryId === c.id ? 'on' : ''}`} style={{ ['--c' as any]: c.color }} onClick={() => set({ categoryId: d.categoryId === c.id ? null : c.id })}>
                {c.name}
              </button>
            ))}
            <button className="chip outline" onClick={() => setNewCat({ name: '', color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length] })}>
              <Plus size={15} /> Nouvelle
            </button>
          </div>
          {newCat && (
            <div className="card" style={{ marginTop: 10 }}>
              <input className="input" placeholder="Nom (ex. Déplacements)" value={newCat.name} autoFocus onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              <div className="swatches" style={{ marginTop: 12 }}>
                {CATEGORY_COLORS.map((c) => (
                  <button key={c} className={`swatch ${newCat.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setNewCat({ ...newCat, color: c })} aria-label={c} />
                ))}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn sm" onClick={() => setNewCat(null)}>Annuler</button>
                <button className="btn sm primary grow" onClick={addCategory}>Ajouter</button>
              </div>
            </div>
          )}
        </div>

        {!existing && (
          <div className="field">
            <span className="label">Répéter</span>
            <div className="chips">
              {([['none', 'Jamais'], ['daily', 'Chaque jour'], ['weekdays', 'En semaine'], ['weekly', 'Chaque semaine']] as [RepeatChoice, string][]).map(([v, l]) => (
                <button key={v} className={`chip ${repeat === v ? 'on' : ''}`} onClick={() => setRepeat(v)}>{l}</button>
              ))}
            </div>
            {repeat === 'weekly' && (
              <div className="daypick" style={{ marginTop: 10 }}>
                {JOURS_LETTRE.map((l, i) => (
                  <button key={i} className={repeatDays.includes(i) ? 'on' : ''}
                    onClick={() => setRepeatDays((x) => (x.includes(i) ? (x.length > 1 ? x.filter((y) => y !== i) : x) : [...x, i].sort()))}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            {repeat !== 'none' && (
              <div className="card row" style={{ marginTop: 10, padding: '6px 14px' }}>
                <span className="grow ttl">Jusqu’au</span>
                <input type="date" className="input" style={{ width: 'auto', minHeight: 40, padding: '8px 12px' }} min={d.date} max={addDays(d.date, 366)} value={until}
                  onChange={(e) => e.target.value && setUntil(e.target.value)} />
              </div>
            )}
          </div>
        )}

        <div className="field">
          <span className="label">Sous-tâches {d.subtasks.length > 0 && `· ${d.subtasks.filter((s) => s.done).length}/${d.subtasks.length}`}</span>
          <div className="card" style={{ padding: '4px 14px' }}>
            {d.subtasks.map((s) => (
              <div key={s.id} className={`subtask ${s.done ? 'done' : ''}`}>
                <button className={`check ${s.done ? 'on' : ''}`} onClick={() => patchSub(s.id, { done: !s.done })} aria-label="Cocher">
                  <Check size={14} strokeWidth={3} />
                </button>
                <input className="plain" value={s.text} onChange={(e) => patchSub(s.id, { text: e.target.value })} />
                <button className="faint" onClick={() => set({ subtasks: d.subtasks.filter((x) => x.id !== s.id) })} aria-label="Retirer">
                  <X size={16} />
                </button>
              </div>
            ))}
            <div className="subtask">
              <span className="check" style={{ borderStyle: 'dashed' }}><Plus size={14} color="var(--text-3)" /></span>
              <input className="plain" placeholder="Ajouter une sous-tâche" value={newSub} enterKeyHint="enter"
                onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} onBlur={addSub} />
            </div>
          </div>
        </div>



        {(!existing || existing.origin === 'app') && (
          <div className="card row" style={{ marginTop: 14 }}>
            <GoogleMark size={20} />
            <div className="grow">
              <div className="ttl">Envoyer vers Google Agenda</div>
              <div className="tiny muted">
                {connected
                  ? 'Titre, horaires et notes. Catégorie et sous-tâches restent dans l’app.'
                  : 'Connectez Google Agenda dans les réglages pour l’activer.'}
              </div>
            </div>
            <Switch checked={connected && d.sync} disabled={!connected} label="Envoyer vers Google Agenda" onChange={(v) => set({ sync: v })} />
          </div>
        )}

        {existing && (
          <p className="tiny faint" style={{ textAlign: 'center', marginTop: 16 }}>
            Créé le {labelDate(new Date(existing.createdAt).toISOString().slice(0, 10))}
            {existing.dirty && connected ? ' · en attente d’envoi vers Google' : ''}
          </p>
        )}
      </Sheet>

      {ask === 'save' && (
        <ChoiceSheet
          title="Élément récurrent"
          message="Appliquer les modifications (titre, horaires, catégorie, notes) à :"
          onClose={() => setAsk(null)}
          choices={[
            { label: 'Cette occurrence uniquement', onPick: () => save('one') },
            { label: 'Toute la série', onPick: () => save('series') },
          ]}
        />
      )}
      {ask === 'delete' && (
        <ChoiceSheet
          title="Supprimer"
          message={existing?.g ? 'La suppression sera aussi faite dans Google Agenda.' : undefined}
          onClose={() => setAsk(null)}
          choices={[
            { label: 'Cette occurrence', danger: true, onPick: () => remove('one') },
            { label: 'Toute la série', danger: true, onPick: () => remove('series') },
          ]}
        />
      )}
      {ask === 'confirmDelete' && (
        <ChoiceSheet
          title="Supprimer ?"
          message={existing?.g ? 'Il sera aussi supprimé de Google Agenda.' : 'Cette action est définitive.'}
          onClose={() => setAsk(null)}
          choices={[{ label: 'Supprimer', danger: true, onPick: () => remove('one') }]}
        />
      )}
    </>
  );
}


