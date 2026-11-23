import { useRef, useState } from 'react';
import {
  AlertTriangle, ChevronRight, Download, Globe, Lock, Moon, Plus, RefreshCw, Share, Smartphone, Snowflake, Sun, SunMoon, Trash2, Upload,
} from 'lucide-react';
import Hello from '../components/Hello';
import { ChoiceSheet, GoogleMark, Segmented, Switch, useUI } from '../components/ui';
import { defaultState } from '../lib/actions';
import { APP_TZ, labelDate, relativeTime } from '../lib/dates';
import {
  cancelConnect, connectGoogle, disconnectGoogle, setCalendarSelected, syncNow, useGoogleRuntime,
} from '../lib/google/client';
import { hydrate, store, update, useApp } from '../lib/store';
import type { ThemePref } from '../lib/types';
import { useNow } from '../useNow';

function GoogleCard() {
  const g = useApp((s) => s.google);
  const categories = useApp((s) => s.categories);
  const rt = useGoogleRuntime();
  const { now } = useNow();
  const [confirm, setConfirm] = useState(false);

  const connected = !!g.session;
  let badge: { cls: string; text: string };
  if (rt.configured === false) badge = { cls: 'warn', text: 'Serveur non configuré' };
  else if (connected && g.authError) badge = { cls: 'err', text: 'Accès expiré' };
  else if (connected && g.lastSyncAt) badge = { cls: 'ok', text: 'Connecté' };
  else if (connected) badge = { cls: 'warn', text: 'Connexion en cours de vérification' };
  else if (rt.connecting) badge = { cls: 'warn', text: 'En attente de Google…' };
  else badge = { cls: '', text: 'Non connecté' };

  const writable = g.calendars.filter((c) => c.accessRole === 'owner' || c.accessRole === 'writer');

  return (
    <div className="card">
      <div className="row" style={{ gap: 12 }}>
        <span className="icon-btn" style={{ background: 'var(--surface-2)' }}><GoogleMark size={22} /></span>
        <div className="grow">
          <div className="ttl" style={{ fontWeight: 600 }}>Google Agenda</div>
          <div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{connected && g.email ? g.email : 'Synchronisation dans les deux sens'}</div>
          <span className={`badge ${badge.cls}`} style={{ marginTop: 6 }} role="status">
            {badge.cls === 'ok' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />}
            {badge.text}
          </span>
        </div>
      </div>

      {rt.configured === false && (
        <div className="notice" style={{ marginTop: 14 }}>
          <strong>Configuration requise.</strong> Le serveur n’a pas encore d’identifiants Google
          (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET). Suivez la section « Connexion Google » du README.
        </div>
      )}
      {rt.configured === null && !connected && (
        <div className="notice" style={{ marginTop: 14 }}>
          Serveur injoignable. La connexion Google nécessite que l’app soit servie par son serveur (npm start).
        </div>
      )}
      {rt.connectError && <div className="notice" style={{ marginTop: 14, color: 'var(--danger)' }}>{rt.connectError}</div>}
      {connected && g.authError && (
        <div className="notice row" style={{ marginTop: 14, gap: 10 }}>
          <AlertTriangle size={16} color="var(--danger)" style={{ flex: 'none' }} />
          <span>Google a révoqué l’accès ou il a expiré. Reconnectez le compte : vos créneaux restent dans l’app.</span>
        </div>
      )}

      {connected && (
        <div className="list-row" style={{ marginTop: 6 }}>
          <div className="grow">
            <div className="ttl">Dernière synchronisation réussie</div>
            <div className="tiny muted">
              {g.lastSyncAt ? relativeTime(g.lastSyncAt, now) : 'jamais'}
              {g.lastError && !g.authError ? ` · dernière erreur : ${g.lastError}` : ''}
            </div>
          </div>
          <button className="icon-btn sm" onClick={() => syncNow()} disabled={rt.syncing} aria-label="Synchroniser maintenant">
            <RefreshCw size={16} className={rt.syncing ? 'spin' : ''} />
          </button>
        </div>
      )}

      {(!connected || g.authError) && (
        <div style={{ marginTop: 14 }}>
          {rt.connecting ? (
            <div className="row">
              <button className="btn block blue grow" onClick={() => connectGoogle()}>Rouvrir la page Google</button>
              <button className="btn" onClick={cancelConnect}>Annuler</button>
            </div>
          ) : (
            <button className="btn block blue" disabled={rt.configured === false} onClick={() => connectGoogle()}>
              <GoogleMark size={18} /> {g.authError ? 'Reconnecter Google Agenda' : 'Connecter Google Agenda'}
            </button>
          )}
          {rt.connecting && <p className="tiny muted" style={{ margin: '10px 4px 0' }}>Autorisez l’accès dans la page Google, puis revenez ici : la connexion se termine automatiquement.</p>}
        </div>
      )}

      {connected && !g.authError && g.calendars.length > 0 && (
        <>
          <div className="section-head" style={{ margin: '18px 0 4px' }}><span className="small muted">Agendas à synchroniser</span></div>
          {g.calendars.map((c) => {
            const on = g.selected.includes(c.id);
            const ro = c.accessRole === 'reader' || c.accessRole === 'freeBusyReader';
            return (
              <div key={c.id} className="list-row" style={{ flexWrap: 'wrap' }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: c.color, flex: 'none' }} />
                <div className="grow">
                  <div className="ttl">{c.summary}{c.primary ? ' (principal)' : ''}</div>
                  <div className="tiny muted">{ro ? <><Lock size={10} /> lecture seule</> : 'lecture et écriture'}</div>
                </div>
                <Switch checked={on} disabled={c.id === g.targetCalendarId} label={c.summary} onChange={(v) => setCalendarSelected(c.id, v)} />
                {on && (
                  <div className="row" style={{ width: '100%', paddingLeft: 24 }}>
                    <span className="tiny muted grow">Catégorie par défaut</span>
                    <select
                      className="select"
                      style={{ width: 'auto', minHeight: 34, padding: '4px 30px 4px 12px', fontSize: 14 }}
                      value={g.calendarCategory[c.id] ?? ''}
                      onChange={(e) => update((s) => ({ ...s, google: { ...s.google, calendarCategory: { ...s.google.calendarCategory, [c.id]: e.target.value || null } } }))}
                    >
                      <option value="">Sans catégorie</option>
                      {categories.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
          <div className="list-row" style={{ flexWrap: 'wrap', rowGap: 6 }}>
            <div className="grow">
              <div className="ttl">Agenda de destination</div>
              <div className="tiny muted">Où sont créés les créneaux envoyés depuis l’app</div>
            </div>
            <select
              className="select"
              style={{ width: 'auto', maxWidth: 170, minHeight: 34, padding: '4px 30px 4px 12px', fontSize: 14 }}
              value={g.targetCalendarId ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                update((s) => ({ ...s, google: { ...s.google, targetCalendarId: id, selected: [...new Set([...s.google.selected, id])] } }));
              }}
            >
              {writable.map((c) => <option key={c.id} value={c.id}>{c.summary}</option>)}
            </select>
          </div>
          <div className="list-row">
            <div className="grow">
              <div className="ttl">Envoyer les nouveaux créneaux par défaut</div>
              <div className="tiny muted">Modifiable pour chaque créneau</div>
            </div>
            <Switch checked={g.defaultSync} label="Envoyer par défaut" onChange={(v) => update((s) => ({ ...s, google: { ...s.google, defaultSync: v } }))} />
          </div>
          <p className="tiny muted" style={{ margin: '10px 2px 0', lineHeight: 1.5 }}>
            Synchronisés : titre, date, horaires, notes (description), récurrences et journées entières, de 2 mois en arrière à 8 mois en avant.
            Restent dans l’app : catégories, sous-tâches, cases cochées et Winter Arc.
          </p>
        </>
      )}

      {connected && (
        <button className="btn block danger" style={{ marginTop: 14 }} onClick={() => setConfirm(true)}>Déconnecter</button>
      )}
      {confirm && (
        <ChoiceSheet
          title="Déconnecter Google Agenda ?"
          message="Les événements importés de Google disparaîtront de l’app. Vos créneaux créés dans l’app sont conservés."
          onClose={() => setConfirm(false)}
          choices={[{ label: 'Déconnecter', danger: true, onPick: () => { disconnectGoogle(); setConfirm(false); } }]}
        />
      )}
    </div>
  );
}

export default function SettingsScreen() {
  const ui = useUI();
  const categories = useApp((s) => s.categories);
  const theme = useApp((s) => s.settings.theme);
  const name = useApp((s) => s.settings.name);
  const challenge = useApp((s) => s.challenge);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reset, setReset] = useState(false);

  function exportData() {
    const { google, ...rest } = store.get();
    const data = { ...rest, google: { ...google, session: undefined } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `givre-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function importData(file: File) {
    try {
      const data = hydrate(JSON.parse(await file.text()));
      const session = store.get().google;
      update(() => ({ ...data, google: { ...data.google, session: session.session, email: session.email, pendingDeletes: [], masterPatches: [] } }));
      ui.toast('Sauvegarde importée');
    } catch {
      ui.toast('Fichier invalide');
    }
  }

  return (
    <div className="screen">
      <Hello />
      <h1 className="display">Réglages</h1>

      <label className="field" style={{ marginTop: 0, marginBottom: 16 }}>
        <span className="label">Votre prénom (pour l’accueil)</span>
        <input className="input" value={name ?? ''} placeholder="ex. Marie" autoComplete="given-name"
          onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, name: e.target.value } }))} />
      </label>

      <GoogleCard />

      <div className="section">
        <div className="section-head">
          <h3 className="section-title">Catégories</h3>
          <button className="link row" style={{ gap: 4 }} onClick={() => ui.open({ type: 'category' })}><Plus size={14} /> Ajouter</button>
        </div>
        <div className="card" style={{ padding: '2px 16px' }}>
          {categories.map((c) => (
            <button key={c.id} className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => ui.open({ type: 'category', id: c.id })}>
              <span style={{ width: 14, height: 14, borderRadius: 5, background: c.color }} />
              <span className="grow ttl">{c.name}</span>
              <ChevronRight size={16} color="var(--text-3)" />
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3 className="section-title">Winter Arc</h3></div>
        <button className="card row" style={{ width: '100%', textAlign: 'left', gap: 12 }} onClick={() => ui.open({ type: 'challenge' })}>
          <Snowflake size={18} />
          <span className="grow">
            <div className="ttl">{challenge.name}</div>
            <div className="tiny muted">Du {labelDate(challenge.startDate)} au {labelDate(challenge.endDate)}</div>
          </span>
          <ChevronRight size={16} color="var(--text-3)" />
        </button>
      </div>

      <div className="section">
        <div className="section-head"><h3 className="section-title">Apparence</h3></div>
        <Segmented<ThemePref>
          value={theme}
          onChange={(v) => update((s) => ({ ...s, settings: { ...s.settings, theme: v } }))}
          options={[
            { value: 'system', label: <span className="row" style={{ justifyContent: 'center', gap: 6 }}><SunMoon size={15} /> Auto</span> },
            { value: 'dark', label: <span className="row" style={{ justifyContent: 'center', gap: 6 }}><Moon size={15} /> Sombre</span> },
            { value: 'light', label: <span className="row" style={{ justifyContent: 'center', gap: 6 }}><Sun size={15} /> Clair</span> },
          ]}
        />
      </div>

      <div className="section">
        <div className="section-head"><h3 className="section-title">Sur l’iPhone</h3></div>
        <div className="card">
          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <Smartphone size={18} style={{ flex: 'none', marginTop: 2 }} />
            <div className="small muted" style={{ lineHeight: 1.5 }}>
              Dans Safari, touchez <Share size={13} style={{ verticalAlign: -2 }} /> <strong>Partager</strong> puis
              <strong> « Sur l’écran d’accueil »</strong>. Givre s’ouvre alors en plein écran comme une app et fonctionne hors connexion.
              Vos données sont enregistrées sur l’appareil.
            </div>
          </div>
          <div className="list-row" style={{ marginTop: 8 }}>
            <Globe size={18} />
            <span className="grow ttl">Fuseau horaire</span>
            <span className="muted small">{APP_TZ}</span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3 className="section-title">Données</h3></div>
        <div className="card" style={{ padding: '2px 16px' }}>
          <button className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={exportData}>
            <Download size={18} /><span className="grow ttl">Exporter une sauvegarde</span>
          </button>
          <button className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => fileRef.current?.click()}>
            <Upload size={18} /><span className="grow ttl">Importer une sauvegarde</span>
          </button>
          <button className="list-row" style={{ width: '100%', textAlign: 'left', color: 'var(--danger)' }} onClick={() => setReset(true)}>
            <Trash2 size={18} /><span className="grow ttl">Tout effacer</span>
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        </div>
      </div>
      <p className="tiny faint" style={{ textAlign: 'center', marginTop: 20 }}>Givre 1.0 · planning & Winter Arc</p>

      {reset && (
        <ChoiceSheet
          title="Tout effacer ?"
          message="Créneaux, catégories, habitudes et historique seront supprimés de cet appareil. Exportez une sauvegarde avant si besoin."
          onClose={() => setReset(false)}
          choices={[{
            label: 'Tout effacer', danger: true, onPick: async () => {
              await disconnectGoogle();
              update(() => defaultState());
              setReset(false);
            },
          }]}
        />
      )}
    </div>
  );
}
