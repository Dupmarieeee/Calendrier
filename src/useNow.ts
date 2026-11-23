import { useEffect, useState } from 'react';
import { nowParisMinutes, todayParis } from './lib/dates';

/** Date et minute courantes à Paris, rafraîchies chaque minute. */
export function useNow() {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 30_000);
    const vis = () => document.visibilityState === 'visible' && setT(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return { today: todayParis(t), minutes: nowParisMinutes(t), now: t };
}
