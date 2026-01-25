import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  format, 
  addWeeks, 
  subWeeks, 
  isSameDay, 
  getWeek, 
  addDays, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth,
  addMonths, 
  subMonths, 
  addYears, 
  subYears, 
  differenceInMinutes, 
  parse, 
  isAfter, 
  startOfDay
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  CheckCircle2, 
  Pause, 
  Play, 
  Settings, 
  X, 
  Palette, 
  Trash2, 
  LayoutGrid, 
  ChevronRight as ChevronRightIcon, 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Calendar as CalendarIcon, 
  Timer, 
  Trophy, 
  BarChart, 
  User, 
  Globe, 
  CalendarDays, 
  ChevronsLeft, 
  ChevronsRight, 
  Moon, 
  Bell, 
  Lock, 
  Mail, 
  LogOut, 
  ArrowRight, 
  Sun, 
  Sprout, 
  Flower2, 
  TreePine, 
  Bird, 
  Sparkles, 
  Zap, 
  Baby, 
  Cloud, 
  CloudCheck, 
  Download, 
  Upload, 
  RefreshCw, 
  Copy, 
  Key,
  WifiOff
} from 'lucide-react';
import { Category, Task, TodoItem, SleepSchedule, GrowthType, GrowthState } from './types';
import { INITIAL_CATEGORIES, TIME_SLOTS, DAYS_FR } from './constants';
import { getWeekDates, formatDate, getDisplayWeek, getWeekId } from './utils/dateUtils';
import { FlowerGrowth, TreeGrowth, BirdGrowth, BabyGrowth } from './GrowthVisuals';
import LandingPage from './LandingPage';

const HOUR_HEIGHT = 60; 
const MIN_TASK_HEIGHT = 26; 

// URL de l'API : Utilise la variable d'environnement VITE_API_URL pour le cloud, ou localhost par défaut
// Fix: Cast import.meta to any to resolve TS error: Property 'env' does not exist on type 'ImportMeta'
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  timezone: string;
  password?: string;
  syncCode?: string;
}

const GROWTH_THRESHOLDS = [0, 50, 150, 400];

const formatSeconds = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatTimeDisplay = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

// --- Components Definitions ---

const AuthScreen: React.FC<{ onAuthSuccess: (user: UserProfile, data: any) => void, isDarkMode: boolean, initialMode: 'login' | 'register' }> = ({ onAuthSuccess, isDarkMode, initialMode }) => {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
        const endpoint = isLogin ? '/login' : '/register';
        const body = isLogin 
            ? { email, password } 
            : { name, email, password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Une erreur est survenue');
        
        onAuthSuccess(data.user, data.data);
    } catch (err: any) {
        console.warn("Connexion serveur échouée, passage en mode local", err);
        
        // --- LOGIQUE DE SECOURS LOCALE (Plan B) ---
        const LOCAL_DB_KEY = 'focus_local_users_db';
        const storedUsers = localStorage.getItem(LOCAL_DB_KEY);
        const localUsers = storedUsers ? JSON.parse(storedUsers) : [];

        if (isLogin) {
            // Tentative de connexion locale
            const user = localUsers.find((u: any) => u.email === email && u.password === password);
            if (user) {
                const { password: _, ...userWithoutPass } = user;
                onAuthSuccess(userWithoutPass, user.data);
            } else {
                alert('Erreur : Email ou mot de passe incorrect (Mode Local).');
            }
        } else {
            // Tentative d'inscription locale
            if (localUsers.find((u: any) => u.email === email)) {
                alert('Erreur : Cet email est déjà utilisé (Mode Local).');
            } else {
                const newUser = {
                    id: Math.random().toString(36).substr(2, 9),
                    name,
                    email,
                    password,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    data: null // Les données par défaut seront initialisées dans App
                };
                localUsers.push(newUser);
                localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(localUsers));
                
                const { password: _, ...userWithoutPass } = newUser;
                onAuthSuccess(userWithoutPass, null);
            }
        }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'dark bg-black' : 'bg-slate-50'}`}>
      <div className="bg-white dark:bg-[#0a0a0a] p-8 rounded-[2.5rem] shadow-xl w-full max-w-md border border-gray-100 dark:border-white/10">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-6 text-center">{isLogin ? 'Connexion' : 'Créer un compte'}</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative z-20">
          {!isLogin && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 p-3 rounded-xl outline-none border border-transparent focus:border-indigo-500 text-slate-800 dark:text-white font-bold mt-1" required />
            </div>
          )}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 p-3 rounded-xl outline-none border border-transparent focus:border-indigo-500 text-slate-800 dark:text-white font-bold mt-1" required />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 p-3 rounded-xl outline-none border border-transparent focus:border-indigo-500 text-slate-800 dark:text-white font-bold mt-1" required />
          </div>
          <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white p-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors mt-4 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? 'Chargement...' : (isLogin ? 'Se connecter' : "S'inscrire")}
          </button>
        </form>
        
        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-white/5">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors">
            {isLogin ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
            </button>
        </div>
      </div>
    </div>
  );
};

const GrowthWidget: React.FC<{ growth: GrowthState, dailyPoints: number, isDarkMode: boolean, onSelect: () => void }> = ({ growth, dailyPoints, isDarkMode, onSelect }) => {
  const level = Math.floor(growth.totalPoints / 100) + 1;
  const progress = growth.totalPoints % 100;
  const stage = Math.min(3, Math.floor(level / 5)); 

  return (
    <div onClick={onSelect} className={`relative rounded-[2.5rem] p-6 shadow-sm border cursor-pointer group transition-transform hover:scale-[1.02] ${isDarkMode ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-slate-100'}`}>
       <div className="flex items-center justify-between relative z-10">
         <div className="flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40">Énergie Focus</h3>
            <div className="flex items-center gap-1.5">
               <Zap size={16} className="text-amber-500 fill-amber-500" />
               <span className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>+{dailyPoints} pts</span>
            </div>
         </div>
         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
            {growth.streak}j
         </div>
       </div>

       <div className="h-32 flex items-center justify-center py-2 relative z-10">
          <div className="w-24 h-24">
             {growth.type === 'fleur' && <FlowerGrowth stage={stage} isDarkMode={isDarkMode} />}
             {growth.type === 'arbre' && <TreeGrowth stage={stage} isDarkMode={isDarkMode} />}
             {growth.type === 'animal' && <BirdGrowth stage={stage} isDarkMode={isDarkMode} />}
             {growth.type === 'humain' && <BabyGrowth stage={stage} isDarkMode={isDarkMode} />}
          </div>
       </div>

       <div className="space-y-1.5 relative z-10">
          <div className={`h-2 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
             <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between items-center text-[9px] font-black uppercase opacity-40">
             <span>Niveau {level}</span>
             <span>{progress}/100</span>
          </div>
       </div>
    </div>
  );
};

const TaskModal: React.FC<{
  categories: Category[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  onDelete?: () => void;
  taskToEdit?: Task;
  isDarkMode: boolean;
  onAddCategory: (name: string, color: string) => string;
  onRemoveCategory: (id: string) => void;
  selectedDate: Date;
}> = ({ categories, onClose, onSubmit, onDelete, taskToEdit, isDarkMode, onAddCategory, onRemoveCategory, selectedDate }) => {
  const [title, setTitle] = useState(taskToEdit?.title || '');
  const [categoryId, setCategoryId] = useState(taskToEdit?.categoryId || categories[0]?.id);
  const [startTime, setStartTime] = useState(taskToEdit?.startTime || '09:00');
  const [durationHours, setDurationHours] = useState(taskToEdit?.durationHours || 1);
  const [date, setDate] = useState(taskToEdit?.date || formatDate(selectedDate));
  
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, categoryId, date, startTime, durationHours: Number(durationHours) });
  };

  const handleAddCategory = () => {
    if (newCatName) {
      const id = onAddCategory(newCatName, newCatColor);
      setCategoryId(id);
      setIsAddingCat(false);
      setNewCatName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-lg rounded-[2.5rem] p-6 shadow-2xl border border-gray-100 dark:border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-800 dark:text-white">{taskToEdit ? 'Modifier' : 'Nouvelle Tâche'}</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-white/20"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
             <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Titre</label>
             <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 p-3 rounded-xl outline-none font-bold text-slate-800 dark:text-white mt-1" placeholder="Ex: Réunion client..." autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 p-3 rounded-xl outline-none font-bold text-slate-800 dark:text-white mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Heure</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 p-3 rounded-xl outline-none font-bold text-slate-800 dark:text-white mt-1" />
            </div>
          </div>

          <div>
             <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex justify-between">
                Durée <span>{durationHours}h</span>
             </label>
             <input type="range" min="0.5" max="8" step="0.5" value={durationHours} onChange={e => setDurationHours(Number(e.target.value))} className="w-full mt-2 accent-indigo-600" />
          </div>

          <div>
             <div className="flex items-center justify-between mb-1">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catégorie</label>
               <button type="button" onClick={() => setIsAddingCat(!isAddingCat)} className="text-[10px] font-bold text-indigo-500 hover:underline">{isAddingCat ? 'Annuler' : '+ Nouvelle'}</button>
             </div>
             
             {isAddingCat ? (
               <div className="flex gap-2 items-center">
                 <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nom" className="flex-1 bg-slate-50 dark:bg-white/5 p-3 rounded-xl outline-none font-bold text-xs" />
                 <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-none" />
                 <button type="button" onClick={handleAddCategory} className="p-3 bg-indigo-600 text-white rounded-xl"><CheckCircle2 size={16} /></button>
               </div>
             ) : (
               <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${categoryId === cat.id ? 'ring-2 ring-offset-2 ring-indigo-500' : 'opacity-70 hover:opacity-100'}`} style={{ backgroundColor: cat.lightColor, color: cat.color }}>
                      {cat.name}
                    </button>
                  ))}
               </div>
             )}
          </div>

          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
            {taskToEdit && (
              <button type="button" onClick={onDelete} className="p-4 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"><Trash2 size={20} /></button>
            )}
            <button type="submit" className="flex-1 bg-indigo-600 text-white p-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors">
              {taskToEdit ? 'Sauvegarder' : 'Créer la tâche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SettingsModal: React.FC<{
  userName: string;
  timezone: string;
  onClose: () => void;
  onLogout: () => void;
  onSave: (name: string, timezone: string) => void;
  isDarkMode: boolean;
  onCopySync: () => void;
}> = ({ userName, timezone, onClose, onLogout, onSave, isDarkMode, onCopySync }) => {
  const [name, setName] = useState(userName);
  const [tz, setTz] = useState(timezone);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl border border-gray-100 dark:border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-800 dark:text-white">Paramètres</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full text-slate-500"><X size={18} /></button>
        </div>
        
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom d'utilisateur</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 p-3 rounded-xl outline-none font-bold text-slate-800 dark:text-white mt-1" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fuseau horaire</label>
            <select value={tz} onChange={e => setTz(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 p-3 rounded-xl outline-none font-bold text-slate-800 dark:text-white mt-1">
              {(Intl as any).supportedValuesOf('timeZone').map((t: string) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex items-center justify-between">
             <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Sync Cloud</span>
               <span className="text-xs text-indigo-400/80 font-medium">Données sauvegardées sur le serveur</span>
             </div>
             <button onClick={onCopySync} className="p-2 bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300 rounded-lg"><Copy size={16} /></button>
          </div>

          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
             <button onClick={onLogout} className="flex-1 p-4 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-xl font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10">Déconnexion</button>
             <button onClick={() => onSave(name, tz)} className="flex-1 bg-indigo-600 text-white p-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700">Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const GrowthSelectionModal: React.FC<{ onSelect: (type: GrowthType) => void, isDarkMode: boolean }> = ({ onSelect, isDarkMode }) => {
  const options: { type: GrowthType, label: string, Icon: any }[] = [
    { type: 'fleur', label: 'La Fleur', Icon: Flower2 },
    { type: 'arbre', label: 'L\'Arbre', Icon: TreePine },
    { type: 'animal', label: 'L\'Oiseau', Icon: Bird },
    { type: 'humain', label: 'L\'Humain', Icon: Baby },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
       <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-2xl rounded-[3rem] p-8 shadow-2xl">
          <h2 className="text-3xl font-black text-center text-slate-800 dark:text-white mb-2">Choisissez votre compagnon</h2>
          <p className="text-center text-slate-500 mb-8 font-medium">Il grandira au rythme de votre productivité.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {options.map(opt => (
               <button key={opt.type} onClick={() => onSelect(opt.type)} className="aspect-square rounded-3xl bg-slate-50 dark:bg-white/5 border-2 border-transparent hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex flex-col items-center justify-center gap-4 group transition-all">
                  <opt.Icon size={32} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-600">{opt.label}</span>
               </button>
             ))}
          </div>
       </div>
    </div>
  );
};

const AddInput: React.FC<{ onAdd: (txt: string) => void, placeholder?: string, className?: string }> = ({ onAdd, placeholder, className }) => {
  const [val, setVal] = useState('');
  return (
    <div className={`relative flex items-center group ${className}`}>
      <input 
        value={val} 
        onChange={e => setVal(e.target.value)} 
        onKeyDown={e => { if (e.key === 'Enter' && val) { onAdd(val); setVal(''); } }} 
        placeholder={placeholder} 
        className="w-full bg-transparent px-2 h-full outline-none text-[10px] font-bold text-black dark:text-white placeholder-slate-400" 
      />
      <button onClick={() => { if (val) { onAdd(val); setVal(''); } }} className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={14} className="text-indigo-500" /></button>
    </div>
  );
};

const SleepDial: React.FC<{ sleep: SleepSchedule, setSleep: (s: SleepSchedule | ((prev: SleepSchedule) => SleepSchedule)) => void, isDarkMode: boolean }> = ({ sleep, setSleep, isDarkMode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState<'bed' | 'wake' | null>(null);

  const getAngle = (clientX: number, clientY: number) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - (rect.left + rect.width / 2);
    const y = clientY - (rect.top + rect.height / 2);
    return (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360;
  };

  const updateTime = useCallback((angle: number, type: 'bed' | 'wake') => {
    const totalMinutes = Math.floor(angle * 4);
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor((totalMinutes % 60) / 10) * 10;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    
    setSleep(prev => ({
      ...prev,
      [type === 'bed' ? 'bedtime' : 'wakeTime']: timeStr
    }));
  }, [setSleep]);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      updateTime(getAngle(clientX, clientY), isDragging);
    };

    const onUp = () => setIsDragging(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDragging, updateTime]);

  const [bH, bM] = sleep.bedtime.split(':').map(Number);
  const [wH, wM] = sleep.wakeTime.split(':').map(Number);
  const startAngle = (bH * 60 + bM) / 4; 
  const endAngle = (wH * 60 + wM) / 4;
  
  let diff = endAngle - startAngle;
  if (diff < 0) diff += 360;

  const endX = 50 + 45 * Math.sin(diff * Math.PI / 180);
  const endY = 50 - 45 * Math.cos(diff * Math.PI / 180);

  const bx = 50 + 45 * Math.cos((startAngle - 90) * Math.PI / 180);
  const by = 50 + 45 * Math.sin((startAngle - 90) * Math.PI / 180);

  const wx = 50 + 45 * Math.cos((endAngle - 90) * Math.PI / 180);
  const wy = 50 + 45 * Math.sin((endAngle - 90) * Math.PI / 180);

  return (
    <div className="w-32 h-32 rounded-full border-[10px] border-slate-50 dark:border-white/5 relative flex items-center justify-center select-none shadow-inner">
      <svg 
        ref={svgRef}
        viewBox="0 0 100 100" 
        className="absolute inset-0 -rotate-90 overflow-visible"
      >
        <circle cx="50" cy="50" r="45" fill="none" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'} strokeWidth="10" />
        
        <path 
          d={`M 50,5 A 45,45 0 ${diff > 180 ? 1 : 0} 1 ${endX} ${endY}`}
          fill="none" 
          stroke="#6366f1" 
          strokeWidth="10" 
          strokeLinecap="round"
          transform={`rotate(${startAngle}, 50, 50)`}
          className="transition-all duration-100" 
        />
        
        {/* Bed Handle - Moon */}
        <g transform={`translate(${bx}, ${by})`} className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => { e.stopPropagation(); setIsDragging('bed'); }} onTouchStart={(e) => { e.stopPropagation(); setIsDragging('bed'); }}>
            <circle cx="0" cy="0" r="10" fill="#818cf8" stroke="white" strokeWidth="2" className="shadow-lg" />
            <g transform="translate(-6, -6)">
               <Moon size={12} className="text-white fill-white/20" />
            </g>
        </g>

        {/* Wake Handle - Bell */}
        <g transform={`translate(${wx}, ${wy})`} className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => { e.stopPropagation(); setIsDragging('wake'); }} onTouchStart={(e) => { e.stopPropagation(); setIsDragging('wake'); }}>
            <circle cx="0" cy="0" r="10" fill="#4f46e5" stroke="white" strokeWidth="2" className="shadow-lg" />
             <g transform="translate(-6, -6)">
               <Bell size={12} className="text-white fill-white/20" />
            </g>
        </g>
      </svg>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [appView, setAppView] = useState<'landing' | 'auth' | 'dashboard'>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('focus_dark_mode') === 'true');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  
  const [growth, setGrowth] = useState<GrowthState>({ type: 'fleur', totalPoints: 0, lastPointsUpdate: formatDate(new Date()), streak: 1 });
  const [isGrowthSelectOpen, setIsGrowthSelectOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStatsDate, setSelectedStatsDate] = useState(new Date()); 
  const [now, setNow] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [sleep, setSleep] = useState<SleepSchedule>({ enabled: true, bedtime: '23:30', wakeTime: '07:00' });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    localStorage.setItem('focus_dark_mode', String(isDarkMode));
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Initial Load from LocalStorage
  useEffect(() => {
    const checkSession = async () => {
        setIsAuthLoading(true);
        const savedUserStr = localStorage.getItem('focus_current_user');
        
        if (savedUserStr) {
            try {
                const user = JSON.parse(savedUserStr);
                setCurrentUser(user);
                currentUserRef.current = user;
                // Note: En mode cloud, on pourrait fetcher les dernières données ici
                // Pour l'instant on garde la session active
                setAppView('dashboard');
            } catch (e) {
                console.error("Session corrupted", e);
                localStorage.removeItem('focus_current_user');
                setAppView('landing');
            }
        } else {
            setAppView('landing');
        }
        setIsAuthLoading(false);
    };
    
    checkSession();
  }, []);

  useEffect(() => {
    clockRef.current = setInterval(() => setNow(new Date()), 60000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  // Sync selectedStatsDate when currentDate (view) changes
  useEffect(() => {
    if (viewMode === 'week') {
       const start = startOfWeek(currentDate, { weekStartsOn: 1 });
       const end = endOfWeek(currentDate, { weekStartsOn: 1 });
       if (selectedStatsDate < start || selectedStatsDate > end) {
           if (isSameDay(new Date(), currentDate) || (new Date() >= start && new Date() <= end)) {
               setSelectedStatsDate(new Date());
           } else {
               setSelectedStatsDate(start);
           }
       }
    } else {
       setSelectedStatsDate(currentDate);
    }
  }, [currentDate, viewMode]);

  // Sync Data to Cloud Server
  useEffect(() => {
    const user = currentUserRef.current;
    if (!user || appView !== 'dashboard') return;
    
    const syncTimeout = setTimeout(() => {
      setIsSyncing(true);
      const dataToSave = { tasks, todos, categories, sleep, growth };
      
      fetch(`${API_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, data: dataToSave })
      })
      .then(res => {
          if (res.ok) setLastSynced(new Date());
          else console.error("Sync server error");
      })
      .catch(e => {
        console.error("Cloud Sync failed", e);
      })
      .finally(() => {
        setIsSyncing(false);
      });

    }, 1000); 

    return () => clearTimeout(syncTimeout);
  }, [tasks, todos, categories, sleep, growth, appView]);

  const dailyPoints = useMemo(() => {
    let pts = 0;
    const todayStr = formatDate(new Date());
    const todayTasks = tasks.filter(t => t.date === todayStr);
    if (todayTasks.length > 0) {
      const completed = todayTasks.filter(t => t.isCompleted).length;
      if (completed / todayTasks.length >= 0.8) pts += 10;
    }
    const [bH, bM] = sleep.bedtime.split(':').map(Number);
    const [wH, wM] = sleep.wakeTime.split(':').map(Number);
    let mins = (wH * 60 + wM) - (bH * 60 + bM);
    if (mins < 0) mins += 1440;
    const hours = mins / 60;
    if (hours >= 7) pts += 15;
    else if (hours >= 6) pts += 5;
    pts += Math.floor(todayTasks.reduce((acc, t) => acc + (t.actualSeconds / 60), 0) / 25) * 5;
    pts += (growth.streak || 0) * 5;
    return pts;
  }, [tasks, sleep, growth.streak]);

  const syncTotalPoints = useCallback(() => {
    const todayStr = formatDate(new Date());
    if (growth.lastPointsUpdate !== todayStr) {
      setGrowth(prev => ({
        ...prev,
        totalPoints: prev.totalPoints + dailyPoints,
        lastPointsUpdate: todayStr,
        streak: isAfter(startOfDay(new Date()), addDays(startOfDay(new Date(prev.lastPointsUpdate)), 1)) ? 1 : prev.streak + 1
      }));
    }
  }, [dailyPoints, growth.lastPointsUpdate]);

  const toggleTimer = useCallback((taskId: string) => {
    if (activeTimerId === taskId) {
      setActiveTimerId(null);
      if (timerRef.current) clearInterval(timerRef.current);
      syncTotalPoints();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setActiveTimerId(taskId);
      timerRef.current = setInterval(() => {
        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            const nextSeconds = t.actualSeconds + 1;
            const targetSeconds = t.durationHours * 3600;
            if (nextSeconds >= targetSeconds) {
              setActiveTimerId(null);
              if (timerRef.current) clearInterval(timerRef.current);
              syncTotalPoints();
              return { ...t, actualSeconds: nextSeconds, isCompleted: true };
            }
            return { ...t, actualSeconds: nextSeconds };
          }
          return t;
        }));
      }, 1000);
    }
  }, [activeTimerId, syncTotalPoints]);

  const weekDates = getWeekDates(currentDate);
  const displayDates = viewMode === 'week' ? weekDates : [currentDate];
  const { label: weekLabel } = getDisplayWeek(currentDate);
  const currentWeekId = getWeekId(currentDate);
  const todayStr = formatDate(new Date());
  
  const weeklySummary = categories.map(cat => {
    const filteredTasks = tasks.filter(t => t.categoryId === cat.id && getWeekId(new Date(t.date)) === currentWeekId);
    return { ...cat, actualHours: filteredTasks.reduce((acc, t) => acc + (t.actualSeconds / 3600), 0), plannedHours: filteredTasks.reduce((acc, t) => acc + t.durationHours, 0) };
  });

  const maxWeeklyHours = Math.max(...weeklySummary.map(s => Math.max(s.actualHours, s.plannedHours)), 1);
  
  const statsDateStr = formatDate(selectedStatsDate);
  const currentStatsSummary = categories.map(cat => {
    const filtered = tasks.filter(t => t.date === statsDateStr && t.categoryId === cat.id);
    return { ...cat, planned: filtered.reduce((acc, t) => acc + t.durationHours, 0), actual: filtered.reduce((acc, t) => acc + (t.actualSeconds / 3600), 0) };
  });

  const totalTodayActual = currentStatsSummary.reduce((acc, s) => acc + s.actual, 0);
  const totalTodayPlanned = currentStatsSummary.reduce((acc, s) => acc + s.planned, 0);

  const getLayoutedTasks = useCallback((dayTasks: Task[]) => {
    if (dayTasks.length === 0) return [];
    const metrics = dayTasks.map(t => {
      const [h, m] = t.startTime.split(':').map(Number);
      const top = (h * HOUR_HEIGHT) + ((m / 60) * HOUR_HEIGHT);
      const height = Math.max(t.durationHours * HOUR_HEIGHT, MIN_TASK_HEIGHT);
      return { task: t, top, height, bottom: top + height };
    });
    metrics.sort((a, b) => a.top - b.top);
    const clusters: typeof metrics[] = [];
    metrics.forEach(item => {
      const cluster = clusters.find(c => c.some(ex => item.top < ex.bottom && item.bottom > ex.top));
      if (cluster) cluster.push(item); else clusters.push([item]);
    });
    const layout: (typeof metrics[0] & { left: number, width: number })[] = [];
    clusters.forEach(cluster => {
      const cols: typeof metrics[] = [];
      cluster.forEach(item => {
        let placed = false;
        for (let i = 0; i < cols.length; i++) {
          if (item.top >= cols[i][cols[i].length - 1].bottom) { cols[i].push(item); placed = true; break; }
        }
        if (!placed) cols.push([item]);
      });
      const width = 100 / cols.length;
      cols.forEach((col, idx) => col.forEach(item => layout.push({ ...item, left: idx * width, width: width - 0.5 })));
    });
    return layout;
  }, []);

  const copySyncCode = () => {
    alert('Vos données sont sauvegardées sur le serveur.');
  };
  
  const handleAuthSuccess = (user: UserProfile, data: any) => {
    setCurrentUser(user);
    localStorage.setItem('focus_current_user', JSON.stringify(user));
    if (data) {
        setTasks(data.tasks || []);
        setTodos(data.todos || []);
        setCategories(data.categories || INITIAL_CATEGORIES);
        setSleep(data.sleep || { enabled: true, bedtime: '23:30', wakeTime: '07:00' });
        setGrowth(data.growth || { type: 'fleur', totalPoints: 0, lastPointsUpdate: formatDate(new Date()), streak: 1 });
        if (!data.growth) setIsGrowthSelectOpen(true);
    }
    setAppView('dashboard');
  };

  if (isAuthLoading) return <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-black"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (appView === 'landing') return <LandingPage onStart={() => { setAuthInitialMode('register'); setAppView('auth'); }} onLogin={() => { setAuthInitialMode('login'); setAppView('auth'); }} />;
  if (appView === 'auth' && !currentUser) return <AuthScreen onAuthSuccess={handleAuthSuccess} isDarkMode={isDarkMode} initialMode={authInitialMode} />;

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-screen bg-[#f1f2f6] dark:bg-black p-4 lg:p-6 overflow-hidden flex`}>
      <aside className="w-80 flex flex-col gap-6 pr-6 border-r border-gray-200 dark:border-white/10 overflow-y-auto custom-scrollbar">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight truncate">Bonjour {currentUser?.name} 👋</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {isSyncing ? 'Sauvegarde...' : 'Sauvegardé'}
            </span>
          </div>
        </header>

        <GrowthWidget growth={growth} dailyPoints={dailyPoints} isDarkMode={isDarkMode} onSelect={() => setIsGrowthSelectOpen(true)} />
        
        {/* To-do List par Catégorie - Compacté pour tout voir */}
        <section className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] p-5 shadow-sm border border-gray-100 dark:border-white/10 flex flex-col gap-3">
           <h3 className="text-slate-700 dark:text-white font-black text-[10px] tracking-widest flex items-center gap-2">
             <CheckCircle2 size={14} className="text-emerald-500" /> To-do List
           </h3>
           <div className="flex flex-col gap-3">
            {categories.map(cat => (
              <div key={cat.id} className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg inline-block w-fit" style={{ backgroundColor: isDarkMode ? `${cat.color}30` : cat.lightColor, color: isDarkMode ? 'white' : cat.color }}>{cat.name}</span>
                {todos.filter(t => t.type === 'daily' && t.date === todayStr && t.text.includes(`[${cat.id}]`)).map(todo => (
                  <div key={todo.id} onClick={() => setTodos(todos.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))} className="flex items-center gap-2 cursor-pointer group pl-1">
                    <div className={`w-3.5 h-3.5 shrink-0 rounded border transition-colors ${todo.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 dark:border-white/10'}`}>{todo.completed && <CheckCircle2 size={10} />}</div>
                    <span className={`text-[10px] ${todo.completed ? 'text-slate-400 line-through' : 'text-slate-600 dark:text-white'}`}>{todo.text.replace(`[${cat.id}]`, '').trim()}</span>
                     <button onClick={(e) => { e.stopPropagation(); setTodos(todos.filter(t => t.id !== todo.id)); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity ml-auto"><Trash2 size={10} /></button>
                  </div>
                ))}
                <AddInput 
                  onAdd={txt => setTodos([...todos, { id: Math.random().toString(36).substr(2, 9), text: `[${cat.id}] ${txt}`, completed: false, type: 'daily', date: todayStr }])} 
                  placeholder="Ajouter..." 
                  className="h-9 border-2 border-dashed border-indigo-200 dark:border-white/20 rounded-xl hover:border-indigo-400 transition-colors mt-1" 
                />
              </div>
            ))}
           </div>
        </section>

        <section className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-white/10 flex flex-col gap-6">
          <h3 className="text-slate-800 dark:text-white font-black text-[10px] tracking-widest flex items-center gap-2"><Moon size={16} className="text-indigo-500" /> Sommeil</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 flex flex-col gap-1 relative overflow-hidden group hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-indigo-200">
               <span className="text-indigo-400 font-black text-[9px] uppercase">Coucher</span>
               <div className="relative">
                 <input 
                   type="time" 
                   value={sleep.bedtime} 
                   onChange={e => setSleep({...sleep, bedtime: e.target.value})} 
                   className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                 />
                 <span className="text-slate-800 dark:text-white font-black text-lg leading-tight flex items-center gap-1">
                   {sleep.bedtime} <Clock size={12} className="opacity-30" />
                 </span>
               </div>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 flex flex-col gap-1 items-end relative overflow-hidden group hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-amber-200">
               <span className="text-amber-500 font-black text-[9px] uppercase">Réveil</span>
               <div className="relative">
                 <input 
                   type="time" 
                   value={sleep.wakeTime} 
                   onChange={e => setSleep({...sleep, wakeTime: e.target.value})} 
                   className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                 />
                 <span className="text-slate-800 dark:text-white font-black text-lg leading-tight flex items-center gap-1">
                   <Clock size={12} className="opacity-30" /> {sleep.wakeTime}
                 </span>
               </div>
            </div>
          </div>
          <div className="relative flex items-center justify-center py-4">
             <SleepDial sleep={sleep} setSleep={setSleep} isDarkMode={isDarkMode} />
             <div className="absolute flex flex-col items-center pointer-events-none">
                <div className="flex items-baseline"><span className="text-4xl font-black text-slate-800 dark:text-white">{Math.floor(((parse(sleep.wakeTime, 'HH:mm', new Date()).getTime() - parse(sleep.bedtime, 'HH:mm', new Date()).getTime()) / 60000 + 1440) % 1440 / 60)}</span><span className="text-xs font-bold text-slate-400 uppercase ml-0.5">h</span></div>
             </div>
          </div>
        </section>

        <section className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-white/10 flex flex-col gap-6">
           <h3 className="text-slate-700 dark:text-white font-black text-[10px] tracking-widest flex items-center gap-2"><BarChart size={14} className="text-blue-500" /> Performance</h3>
           <div className="flex flex-col gap-4">
              {weeklySummary.map(item => (
                <div key={item.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase"><span style={{ color: item.color }}>{item.name}</span><span className="text-slate-400">{formatTimeDisplay(item.actualHours)} / {formatTimeDisplay(item.plannedHours)}</span></div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden relative">
                    <div className="h-full transition-all duration-1000" style={{ width: `${Math.min(100, (item.actualHours / maxWeeklyHours) * 100)}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}

              {/* Ligne TOTAL JOURNÉE ajoutée */}
              <div className="pt-4 mt-2 border-t border-dashed border-gray-200 dark:border-white/10 flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="text-slate-800 dark:text-white">TOTAL {isSameDay(selectedStatsDate, new Date()) ? "JOURNÉE" : format(selectedStatsDate, 'dd/MM')}</span>
                    <span className="text-slate-400">{formatTimeDisplay(totalTodayActual)} / {formatTimeDisplay(totalTodayPlanned)}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden relative">
                    <div className="h-full bg-slate-800 dark:bg-white transition-all duration-1000" style={{ width: `${Math.min(100, (totalTodayActual / Math.max(totalTodayPlanned, 1)) * 100)}%` }} />
                  </div>
              </div>
           </div>
        </section>
      </aside>

      <main className="flex-1 flex flex-col gap-6 ml-6 overflow-hidden">
        <header className="flex items-center justify-between h-14">
          <div className="bg-slate-100 dark:bg-white/10 rounded-xl p-1 flex">
            {['week', 'day'].map(m => <button key={m} onClick={() => setViewMode(m as any)} className={`px-4 py-1.5 text-xs font-bold rounded-lg ${viewMode === m ? 'bg-white dark:bg-white/20 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 dark:text-white/40'}`}>{m === 'week' ? 'Semaine' : 'Jour'}</button>)}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentDate(viewMode === 'week' ? subWeeks(currentDate, 1) : subDays(currentDate, 1))} className="p-2 text-slate-400"><ChevronLeft /></button>
            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{viewMode === 'week' ? weekLabel : format(currentDate, 'EEEE d MMMM', { locale: fr })}</h2>
            <button onClick={() => setCurrentDate(viewMode === 'week' ? addWeeks(currentDate, 1) : addDays(currentDate, 1))} className="p-2 text-slate-400"><ChevronRight /></button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-white dark:bg-white/10 rounded-2xl border border-gray-100 dark:border-white/10">{isDarkMode ? <Sun className="text-amber-400" /> : <Moon className="text-slate-600" />}</button>
            <button onClick={() => { setEditingTask(null); setIsModalOpen(true); }} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none"><Plus /></button>
            <button onClick={() => setIsSettingsModalOpen(true)} className="p-3 bg-white dark:bg-white/10 rounded-2xl border border-gray-100 dark:border-white/10 text-slate-400"><Settings /></button>
          </div>
        </header>

        <div className="flex-1 bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] shadow-sm border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden">
           <div className="flex border-b border-gray-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
              <div className="w-20" />
              {displayDates.map((d, i) => {
                const isSelected = isSameDay(d, selectedStatsDate);
                const isToday = isSameDay(d, new Date());
                return (
                  <div 
                    key={i} 
                    onClick={() => setSelectedStatsDate(d)}
                    className={`flex-1 py-4 text-center flex flex-col gap-1 cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-white/10 ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                  >
                    <span className={`text-[10px] font-black uppercase ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{DAYS_FR[d.getDay() === 0 ? 6 : d.getDay() - 1]}</span>
                    <span className={`text-sm font-black ${isToday ? 'text-white bg-indigo-600 w-8 h-8 flex items-center justify-center rounded-full mx-auto' : 'text-slate-300 dark:text-white/20'}`}>{format(d, 'd')}</span>
                  </div>
                );
              })}
           </div>
           <div className="flex-1 overflow-y-auto relative flex custom-scrollbar">
              <div className="w-20 bg-slate-50/30 dark:bg-white/5 border-r border-indigo-200 dark:border-white/10 shrink-0">
                {TIME_SLOTS.map(t => <div key={t} style={{ height: HOUR_HEIGHT }} className="border-b border-dashed border-indigo-200 dark:border-white/10 flex justify-center pt-2 text-[10px] font-bold text-slate-300 uppercase">{t}</div>)}
              </div>
              
              {/* Le conteneur principal a maintenant une hauteur minimale de 24 * HOUR_HEIGHT pour que les lignes verticales aillent jusqu'en bas */}
              <div className="flex-1 flex relative" style={{ minHeight: 24 * HOUR_HEIGHT }}>
                {displayDates.map((date, idx) => {
                  const dayStr = formatDate(date);
                  const layout = getLayoutedTasks(tasks.filter(t => t.date === dayStr));
                  const isSelected = isSameDay(date, selectedStatsDate);
                  const isToday = isSameDay(date, now);
                  const currentMinutes = now.getHours() * 60 + now.getMinutes();
                  const currentTimeTop = (currentMinutes / 60) * HOUR_HEIGHT;
                  
                  return (
                    <div key={idx} 
                         onClick={() => setSelectedStatsDate(date)}
                         onDragOver={e => e.preventDefault()} 
                         onDrop={e => {
                          if (!draggedTaskId) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const mins = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
                          const h = Math.min(23, Math.max(0, Math.floor(mins / 60)));
                          const m = Math.floor((mins % 60) / 5) * 5;
                          setTasks(tasks.map(t => t.id === draggedTaskId ? { ...t, date: dayStr, startTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}` } : t));
                          setDraggedTaskId(null);
                          setSelectedStatsDate(parse(dayStr, 'yyyy-MM-dd', new Date()));
                        }} 
                        className={`flex-1 border-r border-dashed border-indigo-200 dark:border-white/10 relative last:border-r-0 ${isSelected ? 'bg-indigo-50/20 dark:bg-indigo-900/5' : ''}`}>
                      
                      {/* LIGNES HORIZONTALES SIMPLES EN POINTILLÉS */}
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div 
                           key={`line-${i}`} 
                           className="absolute w-full border-b border-dashed border-indigo-200 dark:border-white/5 pointer-events-none" 
                           style={{ top: (i + 1) * HOUR_HEIGHT }} 
                        />
                      ))}
                      
                      {/* INDICATEUR DE TEMPS ACTUEL (Ligne Rouge) */}
                      {isToday && (
                        <div className="absolute w-full z-20 pointer-events-none flex items-center" style={{ top: currentTimeTop }}>
                           <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5 shrink-0 shadow-sm" />
                           <div className="h-[2px] w-full bg-red-500" />
                        </div>
                      )}

                      {layout.map(item => {
                        const cat = categories.find(c => c.id === item.task.categoryId) || categories[0];
                        return (
                          <div key={item.task.id} draggable onDragStart={() => setDraggedTaskId(item.task.id)} onDoubleClick={() => { setEditingTask(item.task); setIsModalOpen(true); }} className="absolute rounded-xl p-2 shadow-sm border-2 border-white/50 dark:border-white/10 z-10 cursor-grab active:cursor-grabbing overflow-hidden group" style={{ top: item.top, height: item.height, left: `${item.left}%`, width: `${item.width}%`, backgroundColor: isDarkMode ? `${cat.color}60` : cat.lightColor }}>
                            <div className="flex flex-col h-full justify-between">
                               <div className="flex flex-col"><span className="text-[8px] font-black uppercase" style={{ color: isDarkMode ? 'white' : cat.color }}>{cat.name}</span><h4 className="text-[11px] font-black leading-tight" style={{ color: isDarkMode ? 'white' : cat.color }}>{item.task.title}</h4></div>
                               <div className="flex items-center justify-between mt-auto">
                                  <button onClick={e => { e.stopPropagation(); toggleTimer(item.task.id); }} className={`p-1 rounded-full ${activeTimerId === item.task.id ? 'bg-orange-500 text-white animate-pulse' : 'bg-white/80 text-slate-500'}`}>{activeTimerId === item.task.id ? <Pause size={10} /> : <Play size={10} />}</button>
                                  {item.task.actualSeconds > 0 && <span className="text-[9px] font-mono font-black" style={{ color: isDarkMode ? 'white' : cat.color }}>{formatSeconds(item.task.actualSeconds)}</span>}
                               </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
           </div>
           
           {/* Bottom Summary Section - Maintenant lié à selectedStatsDate */}
           <div className="p-6 border-t border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-3">
                    <span>TOTAL POUR {isSameDay(selectedStatsDate, new Date()) ? "AUJOURD'HUI" : format(selectedStatsDate, 'EEEE d MMMM', { locale: fr })}</span>
                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg text-xs">
                       {formatTimeDisplay(totalTodayPlanned)} <span className="opacity-60 font-medium">PRÉVU</span>
                    </span>
                 </h3>
                 <span className="text-xs font-bold text-slate-400">Cliquez sur un jour pour voir le détail</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                 {currentStatsSummary.map(item => (
                   <div key={item.id} className="min-w-[240px] p-5 rounded-3xl border flex items-center justify-between" style={{ backgroundColor: isDarkMode ? `${item.color}30` : item.lightColor, borderColor: `${item.color}40` }}>
                      <div className="flex flex-col"><span className="text-[10px] font-black uppercase" style={{ color: isDarkMode ? 'white' : item.color }}>{item.name}</span><span className="text-[10px] font-bold opacity-60" style={{ color: isDarkMode ? 'white' : item.color }}>Prévu: {formatTimeDisplay(item.planned)}</span></div>
                      <div className="flex flex-col items-end"><span className="text-xl font-black" style={{ color: isDarkMode ? 'white' : item.color }}>{formatTimeDisplay(item.actual)}</span><span className="text-[8px] font-black opacity-40 uppercase">RÉEL</span></div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </main>

      {isModalOpen && <TaskModal categories={categories} onClose={() => { setIsModalOpen(false); setEditingTask(null); }} onSubmit={data => { if (editingTask) setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...data } : t)); else setTasks([...tasks, { ...data, id: Math.random().toString(36).substr(2, 9), actualSeconds: 0, isCompleted: false }]); setSelectedStatsDate(parse(data.date, 'yyyy-MM-dd', new Date())); setIsModalOpen(false); }} onDelete={editingTask ? () => { setTasks(tasks.filter(t => t.id !== editingTask.id)); setIsModalOpen(false); } : undefined} taskToEdit={editingTask || undefined} isDarkMode={isDarkMode} onAddCategory={(name, color) => { const id = `cat-${Math.random().toString(36).substr(2, 9)}`; setCategories([...categories, { id, name, color, lightColor: `${color}20` }]); return id; }} onRemoveCategory={id => setCategories(categories.filter(c => c.id !== id))} selectedDate={selectedStatsDate} />}
      {isSettingsModalOpen && <SettingsModal userName={currentUser?.name || ''} timezone={currentUser?.timezone || ''} onClose={() => setIsSettingsModalOpen(false)} onLogout={() => { setCurrentUser(null); localStorage.removeItem('focus_current_user'); setAppView('landing'); }} onSave={(n, t) => { if (currentUser) { const u = { ...currentUser, name: n, timezone: t }; setCurrentUser(u); localStorage.setItem('focus_current_user', JSON.stringify(u)); } setIsSettingsModalOpen(false); }} isDarkMode={isDarkMode} onCopySync={copySyncCode} />}
      {isGrowthSelectOpen && <GrowthSelectionModal onSelect={type => { setGrowth(prev => ({ ...prev, type })); setIsGrowthSelectOpen(false); }} isDarkMode={isDarkMode} />}
    </div>
  );
};

export default App;