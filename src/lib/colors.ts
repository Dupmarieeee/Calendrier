import { UNCATEGORIZED } from './stats';
import type { AppState, Item } from './types';

/** Couleur d'un élément : catégorie, sinon couleur de l'agenda Google, sinon gris. */
export function itemColor(s: Pick<AppState, 'categories' | 'google'>, it: Item): string {
  if (it.categoryId) {
    const c = s.categories.find((x) => x.id === it.categoryId);
    if (c) return c.color;
  }
  if (it.g) {
    const cal = s.google.calendars.find((c) => c.id === it.g!.calendarId);
    if (cal) return cal.color;
  }
  return UNCATEGORIZED.color;
}
