import { Category } from './types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Formation', color: '#c084fc', lightColor: '#f3e8ff' },
  { id: 'cat-2', name: 'Étude de concurrence', color: '#60a5fa', lightColor: '#dbeafe' },
  { id: 'cat-3', name: 'Prospection', color: '#fbbf24', lightColor: '#fef3c7' },
  { id: 'cat-4', name: 'Réseaux sociaux', color: '#4ade80', lightColor: '#dcfce7' },
  { id: 'cat-5', name: 'Sport', color: '#f472b6', lightColor: '#fce7f3' },
];

export const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  return `${i.toString().padStart(2, '0')}:00`;
});

export const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];