import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import type { ISODate } from '../lib/types';

// ------------------------------------------------------------ Contexte d'interface
export interface ItemPreset {
  kind?: 'event' | 'task';
  date?: ISODate;
  start?: string | null;
  end?: string | null;
}

export type Modal =
  | { type: 'create' }
  | { type: 'item'; id?: string; preset?: ItemPreset }
  | { type: 'habit'; id?: string }
  | { type: 'challenge' }
  | { type: 'category'; id?: string }
  | { type: 'habitDay'; date: ISODate };

interface UI {
  open(m: Modal): void;
  close(): void;
  toast(msg: string): void;
}

export const UIContext = createContext<UI>({ open() {}, close() {}, toast() {} });
export const useUI = () => useContext(UIContext);

// ------------------------------------------------------------ Feuille
export function Sheet({
  title, onClose, children, footer, onConfirm,
}: { title?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; onConfirm?: () => void }) {
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Glisser la poignée vers le bas pour fermer
  const onGripDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onGripMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    ref.current.style.transform = `translate(-50%, ${drag.current.dy}px)`;
  };
  const onGripUp = () => {
    if (!drag.current || !ref.current) return;
    const dy = drag.current.dy;
    drag.current = null;
    if (dy > 90) close();
    else ref.current.style.transform = '';
  };

  return (
    <>
      <div className={`sheet-backdrop ${closing ? 'closing' : ''}`} onClick={close} />
      <div className={`sheet ${closing ? 'closing' : ''}`} ref={ref} role="dialog" aria-modal="true">
        <div onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} style={{ touchAction: 'none', paddingBottom: 2 }}>
          <div className="sheet-grip" />
          <div className="sheet-head">
            <button className="icon-btn" onClick={close} aria-label="Fermer">
              <X size={19} />
            </button>
            <h2>{title}</h2>
            {onConfirm ? (
              <button className="icon-btn dark" onClick={onConfirm} aria-label="Valider">
                <Check size={19} strokeWidth={2.6} />
              </button>
            ) : <span style={{ width: 46 }} />}
          </div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}

/** Feuille de choix simple (ex. « Cette occurrence / Toute la série »). */
export function ChoiceSheet({
  title, message, choices, onClose,
}: {
  title: string;
  message?: string;
  choices: { label: string; danger?: boolean; onPick: () => void }[];
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      {message && <p className="muted small" style={{ margin: '0 4px 14px', textAlign: 'center' }}>{message}</p>}
      <div className="action-list">
        {choices.map((c) => (
          <button key={c.label} className={`btn block ${c.danger ? 'danger' : ''}`} onClick={c.onPick}>
            {c.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------ Petits composants
export function Ring({
  value, size = 96, stroke = 10, color = 'var(--lime)', track = 'rgba(255,255,255,0.1)', children,
}: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} style={{ transition: 'stroke-dasharray 0.5s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function GoogleMark({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Google Agenda">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function vibrate(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch { /* iOS : pas de vibration web */ }
}
