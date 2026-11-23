import type { ReactNode } from 'react';
import { useApp } from '../lib/store';
import { useNow } from '../useNow';

/** Salutation avec avatar (maquettes : « Good Day », « Good Morning »). */
export default function Hello({ right }: { right?: ReactNode }) {
  const name = useApp((s) => s.settings.name);
  const { minutes } = useNow();
  const greet = minutes < 5 * 60 || minutes >= 18 * 60 ? 'Bonsoir' : 'Bonjour';
  const initial = (name?.trim()[0] ?? '❄').toUpperCase();
  return (
    <div className="headbar">
      <div className="hello grow">
        <span className="avatar" aria-hidden>{initial}</span>
        <div>
          <div className="hi">{greet} 👋</div>
          <div className="name">{name?.trim() || 'Bienvenue'}</div>
        </div>
      </div>
      {right}
    </div>
  );
}
