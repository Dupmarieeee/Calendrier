
import { format, startOfWeek, endOfWeek, addDays, getWeek, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

export const getWeekDates = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
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
