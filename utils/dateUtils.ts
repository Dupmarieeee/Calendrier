
import { format, addDays, getWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

// Custom implementation for startOfWeek as it's not exported from the provided library version
const startOfWeekCustom = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  // Adjust for Monday start: Sunday (0) becomes 6, Monday (1) becomes 0, etc.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const result = new Date(d.setDate(diff));
  result.setHours(0, 0, 0, 0);
  return result;
};

export const getWeekDates = (date: Date) => {
  const start = startOfWeekCustom(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

export const getDisplayWeek = (date: Date) => {
  const weekNum = getWeek(date, { weekStartsOn: 1 });
  const month = format(date, 'MMMM', { locale: fr });
  return {
    label: `Semaine ${weekNum.toString().padStart(2, '0')}`,
    month: month.charAt(0).toUpperCase() + month.slice(1)
  };
};

export const getWeekId = (date: Date) => {
  const weekNum = getWeek(date, { weekStartsOn: 1 });
  const year = date.getFullYear();
  return `${year}-W${weekNum}`;
};