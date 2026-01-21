
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  format, 
  addWeeks, 
  isSameDay, 
  addDays, 
  isAfter
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
  ChevronRight as ChevronRightIcon,
  BarChart,
  Moon,
  Bell,
  LogOut,
  Sun,
  Flower2,
  TreePine,
  Bird,
  Sparkles,
  Zap,
  Baby,
  Copy,
  RefreshCw,
  CloudCheck
} from 'lucide-react';
import { Category, Task, TodoItem, SleepSchedule, GrowthType, GrowthState } from './types';
import { INITIAL_CATEGORIES, TIME_SLOTS, DAYS_FR } from './constants';
import { getWeekDates, formatDate, getDisplayWeek, getWeekId } from './utils/dateUtils';
import { FlowerGrowth, TreeGrowth, BirdGrowth, BabyGrowth } from './GrowthVisuals';
import LandingPage from './LandingPage';

const HOUR_HEIGHT = 120; 
const MIN_TASK_HEIGHT = 28; 

interface UserProfile {
  id: string;
  name: string;
  email: string;
  timezone: string;
}

const GROWTH_THRESHOLDS = [0, 50, 150, 400];

const customStartOfDay = (date: Date | number | string) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

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

const GrowthWidget: React.FC<{ growth: GrowthState, dailyPoints: number, isDarkMode: boolean, onSelect: () => void }> = ({ growth, dailyPoints, isDarkMode, onSelect }) => {
  const stage = GROWTH_THRESHOLDS.findIndex((t, i) => {
    const next = GROWTH_THRESHOLDS[i + 1];
    return growth.totalPoints >= t && (!next || growth.totalPoints < next);
  });
  const currentStage = stage === -1 ? GROWTH_THRESHOLDS.length - 1 : stage;
  const nextThreshold = GROWTH_THRESHOLDS[currentStage + 1];
  const progress = nextThreshold ? (growth.totalPoints / nextThreshold) * 100 : 100;

  const renderGrowth = () => {
    switch (growth.type) {
      case 'fleur': return <FlowerGrowth stage={currentStage} isDarkMode={isDarkMode} />;
      case 'arbre': return <TreeGrowth stage={currentStage} isDarkMode={isDarkMode} />;
      case 'animal': return <BirdGrowth stage={currentStage} isDarkMode={isDarkMode} />;
      case 'humain': return <BabyGrowth stage={currentStage} isDarkMode={isDarkMode} />;
      default: return <FlowerGrowth stage={currentStage} isDarkMode={isDarkMode} />;
    }
  };

  return (
    <section className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-white/10 flex flex-col gap-3 relative overflow-hidden group">
      <div className="flex items-center justify-between relative z-10">
        <div className="flex flex-col">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/40">Énergie Focus</h3>
          <div className="flex items-center gap-1">
            <Zap size={16} className="text-amber-500 fill-amber-500" />
            <span className="text-2xl font-black text-slate-800 dark:text-white">+{dailyPoints} pts</span>
          </div>
        </div>
        <button onClick={onSelect} className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors">
          <Palette size={18} />
        </button>
      </div>
      <div className="flex flex-col items-center gap-4 py-2 relative z-10">
        <div className="w-24 h-24">{renderGrowth()}</div>
        <p className="text-[11px] font-bold text-slate-500 dark:text-white/40 italic">"Chaque minute compte."</p>
      </div>
      <div className="space-y-1 relative z-10">
        <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_12px_rgba(99,102,241,0.4)]" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400 dark:text-white/30 tracking-widest">
          <span>Niveau {currentStage + 1}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>
    </section>
  );
};

// Fixed destructuring to include onAddCategory and onRemoveCategory
const TaskModal: React.FC<{ 
  categories: Category[], onClose: () => void, onSubmit: (data: any) => void, onDelete?: () => void, 
  taskToEdit?: Task, isDarkMode: boolean, onAddCategory: (n: string, c: string) => string, 
  onRemoveCategory: (id: string) => void, selectedDate: Date 
}> = ({ categories, onClose, onSubmit, onDelete, taskToEdit, isDarkMode, onAddCategory, onRemoveCategory, selectedDate }) => {
  const [title, setTitle] = useState(taskToEdit?.title || '');
  const [catId, setCatId] = useState(taskToEdit?.categoryId || categories[0]?.id || '');
  const [time, setTime] = useState(taskToEdit?.startTime || '09:00');
  const [duration, setDuration] = useState(taskToEdit?.durationHours || 1);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-md rounded-[3rem] p-8 shadow-2xl border border-white/10 flex flex-col gap-6 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{taskToEdit ? 'Modifier' : 'Nouvelle'} tâche</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"><X /></button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">TITRE</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nom de la tâche" className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 ring-indigo-500" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">CATÉGORIE</label>
            <select value={catId} onChange={e => setCatId(e.target.value)} className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 ring-indigo-500 appearance-none">
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">HEURE</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 ring-indigo-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">DURÉE (H)</label>
              <input type="number" step="0.5" min="0.5" value={duration} onChange={e => setDuration(Number(e.target.value))} className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 ring-indigo-500" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          {onDelete && <button onClick={onDelete} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors"><Trash2 size={20} /></button>}
          <button onClick={() => onSubmit({ title, categoryId: catId, date: formatDate(selectedDate), startTime: time, durationHours: duration })} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all">
            {taskToEdit ? 'Mettre à jour' : 'Créer la tâche'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SettingsModal: React.FC<{ 
  userName: string, timezone: string, onClose: () => void, onLogout: () => void, 
  onSave: (name: string, timezone: string) => void, isDarkMode: boolean,
  generateSyncToken: () => string
}> = ({ userName, onClose, onLogout, onSave, generateSyncToken }) => {
  const [name, setName] = useState(userName);

  const handleCopy = () => {
    const token = generateSyncToken();
    navigator.clipboard.writeText(token);
    alert("Jeton copié ! Collez-le sur votre autre appareil pour retrouver tous vos rendez-vous.");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-md rounded-[3rem] p-8 shadow-2xl border border-white/10 flex flex-col gap-6 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Paramètres</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"><X /></button>
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">NOM</label>
            <input value={name} onChange={e => setName(e.target.value)} className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 ring-indigo-500" />
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-500/20 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <RefreshCw size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Synchronisation Cloud</span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Transférez vos rendez-vous sur un autre ordinateur :</p>
            <button onClick={handleCopy} className="w-full py-3 bg-white dark:bg-white/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all">
              <Copy size={14} /> GÉNÉRER MON JETON FOCUS
            </button>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button onClick={() => onSave(name, 'Europe/Paris')} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg">Sauvegarder</button>
            <button onClick={onLogout} className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2"><LogOut size={16} /> Déconnexion</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const GrowthSelectionModal: React.FC<{ onSelect: (type: GrowthType) => void, isDarkMode: boolean }> = ({ onSelect }) => {
  const options: { type: GrowthType, icon: React.ReactNode, name: string, color: string }[] = [
    { type: 'fleur', icon: <Flower2 size={24} />, name: 'La Fleur', color: 'text-pink-500' },
    { type: 'arbre', icon: <TreePine size={24} />, name: "L'Arbre", color: 'text-green-500' },
    { type: 'animal', icon: <Bird size={24} />, name: "L'Oiseau", color: 'text-blue-500' },
    { type: 'humain', icon: <Baby size={24} />, name: "L'Humain", color: 'text-orange-500' },
  ];
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
      <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-xl rounded-[3rem] p-10 shadow-2xl border border-white/10 flex flex-col gap-8 items-center text-center animate-in zoom-in-95 duration-500">
        <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Choisissez votre destin</h2>
        <div className="grid grid-cols-2 gap-4 w-full">
           {options.map(opt => (
             <button key={opt.type} onClick={() => onSelect(opt.type)} className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] flex flex-col items-center gap-3 border border-transparent hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group">
                <div className={`w-12 h-12 rounded-2xl bg-white dark:bg-white/10 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform ${opt.color}`}>{opt.icon}</div>
                <span className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px]">{opt.name}</span>
             </button>
           ))}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [appView, setAppView] = useState<'landing' | 'auth' | 'dashboard'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('focus_dark_mode') === 'true');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [growth, setGrowth] = useState<GrowthState>({ type: 'fleur', totalPoints: 0, lastPointsUpdate: formatDate(new Date()), streak: 1 });
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [sleep, setSleep] = useState<SleepSchedule>({ enabled: true, bedtime: '23:30', wakeTime: '07:00' });
  const [dataLoaded, setDataLoaded] = useState(false);

  const [isGrowthSelectOpen, setIsGrowthSelectOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    localStorage.setItem('focus_dark_mode', String(isDarkMode));
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    const savedUserId = localStorage.getItem('focus_last_active_user');
    const usersJson = localStorage.getItem('focus_users_db');
    if (savedUserId && usersJson) {
      const users: UserProfile[] = JSON.parse(usersJson);
      const user = users.find(u => u.id === savedUserId);
      if (user) {
        setCurrentUser(user);
        setAppView('dashboard');
      }
    }
    setIsAuthLoading(false);
  }, []);

  useEffect(() => {
    clockRef.current = setInterval(() => {}, 60000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  const generateSyncToken = useCallback(() => {
    if (!currentUser) return "";
    const payload = { user: currentUser, tasks, todos, categories, sleep, growth, timestamp: Date.now() };
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  }, [currentUser, tasks, todos, categories, sleep, growth]);

  useEffect(() => {
    if (!currentUser) { setDataLoaded(false); return; }
    const prefix = `focus_data_${currentUser.id}_`;
    const savedTasks = localStorage.getItem(`${prefix}tasks`);
    const savedTodos = localStorage.getItem(`${prefix}todos`);
    const savedCategories = localStorage.getItem(`${prefix}categories`);
    const savedSleep = localStorage.getItem(`${prefix}sleep`);
    const savedGrowth = localStorage.getItem(`${prefix}growth`);
    setTasks(savedTasks ? JSON.parse(savedTasks) : []);
    setTodos(savedTodos ? JSON.parse(savedTodos) : []);
    setCategories(savedCategories ? JSON.parse(savedCategories) : INITIAL_CATEGORIES);
    setSleep(savedSleep ? JSON.parse(savedSleep) : { enabled: true, bedtime: '23:30', wakeTime: '07:00' });
    if (savedGrowth) setGrowth(JSON.parse(savedGrowth));
    setDataLoaded(true);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !dataLoaded) return;
    const prefix = `focus_data_${currentUser.id}_`;
    localStorage.setItem(`${prefix}tasks`, JSON.stringify(tasks));
    localStorage.setItem(`${prefix}todos`, JSON.stringify(todos));
    localStorage.setItem(`${prefix}categories`, JSON.stringify(categories));
    localStorage.setItem(`${prefix}sleep`, JSON.stringify(sleep));
    localStorage.setItem(`${prefix}growth`, JSON.stringify(growth));
  }, [tasks, todos, categories, sleep, growth, currentUser, dataLoaded]);

  const dailyPoints = useMemo(() => {
    let pts = 0;
    const todayStr = formatDate(new Date());
    const todayTasks = tasks.filter(t => t.date === todayStr);
    if (todayTasks.length > 0) {
      const completed = todayTasks.filter(t => t.isCompleted).length;
      if (completed / todayTasks.length >= 0.8) pts += 10;
    }
    pts += (growth.streak || 0) * 5;
    return pts;
  }, [tasks, growth.streak]);

  const syncTotalPoints = useCallback(() => {
    const todayStr = formatDate(new Date());
    if (growth.lastPointsUpdate !== todayStr) {
      setGrowth(prev => ({
        ...prev,
        totalPoints: prev.totalPoints + dailyPoints,
        lastPointsUpdate: todayStr,
        streak: isAfter(customStartOfDay(new Date()), addDays(customStartOfDay(new Date(prev.lastPointsUpdate)), 1)) ? 1 : prev.streak + 1
      }));
    }
  }, [dailyPoints, growth.lastPointsUpdate]);

  // Fixed: Error in file App.tsx on line 541: Cannot find name 'handleLogout'.
  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('focus_last_active_user');
    setAppView('landing');
    setDataLoaded(false);
  }, []);

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
  
  const weeklySummary = categories.map(cat => {
    const filteredTasks = tasks.filter(t => t.categoryId === cat.id && getWeekId(new Date(t.date)) === currentWeekId);
    return { ...cat, actualHours: filteredTasks.reduce((acc, t) => acc + (t.actualSeconds / 3600), 0), plannedHours: filteredTasks.reduce((acc, t) => acc + t.durationHours, 0) };
  });

  const maxWeeklyHours = Math.max(...weeklySummary.map(s => Math.max(s.actualHours, s.plannedHours)), 1);

  const getLayoutedTasks = useCallback((dayTasks: Task[]) => {
    if (dayTasks.length === 0) return [];
    const metrics = dayTasks.map(t => {
      const [h, m] = t.startTime.split(':').map(Number);
      const top = (h * HOUR_HEIGHT) + ((m / 60) * HOUR_HEIGHT);
      const height = Math.max(t.durationHours * HOUR_HEIGHT, MIN_TASK_HEIGHT);
      return { task: t, top, height, bottom: top + height };
    });
    metrics.sort((a, b) => a.top - b.top);
    const layout: (typeof metrics[0] & { left: number, width: number })[] = metrics.map(m => ({ ...m, left: 0, width: 99.5 }));
    return layout;
  }, []);

  const restoreFromToken = (token: string) => {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(token))));
      if (data.user && data.tasks) {
        const usersJson = localStorage.getItem('focus_users_db');
        let users: UserProfile[] = usersJson ? JSON.parse(usersJson) : [];
        if (!users.find(u => u.id === data.user.id)) { users.push(data.user); localStorage.setItem('focus_users_db', JSON.stringify(users)); }
        setCurrentUser(data.user);
        setTasks(data.tasks);
        setTodos(data.todos);
        setCategories(data.categories);
        setSleep(data.sleep);
        setGrowth(data.growth);
        setDataLoaded(true);
        setAppView('dashboard');
        return true;
      }
    } catch (e) { return false; }
    return false;
  };

  if (isAuthLoading) return <div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (appView === 'landing') return <LandingPage onStart={() => { setAuthMode('signup'); setAppView('auth'); }} onLogin={() => { setAuthMode('login'); setAppView('auth'); }} />;
  if (appView === 'auth' && !currentUser) return (
    <AuthScreen 
      initialIsLogin={authMode === 'login'}
      onAuthSuccess={user => { setCurrentUser(user); localStorage.setItem('focus_last_active_user', user.id); setAppView('dashboard'); }} 
      onTokenRestore={restoreFromToken}
      isDarkMode={isDarkMode} 
      onBack={() => setAppView('landing')} 
    />
  );

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-screen bg-[#f1f2f6] dark:bg-black p-4 lg:p-6 overflow-hidden flex`}>
      <aside className="w-80 flex flex-col gap-6 pr-6 border-r border-gray-200 dark:border-white/10 overflow-y-auto custom-scrollbar">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Bonjour {currentUser?.name} 👋</h1>
        <GrowthWidget growth={growth} dailyPoints={dailyPoints} isDarkMode={isDarkMode} onSelect={() => setIsGrowthSelectOpen(true)} />
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
           </div>
        </section>
      </aside>

      <main className="flex-1 flex flex-col gap-6 ml-6 overflow-hidden">
        <header className="flex items-center justify-between h-14">
          <div className="bg-slate-100 dark:bg-white/10 rounded-xl p-1 flex">
            {['week', 'day'].map(m => <button key={m} onClick={() => setViewMode(m as any)} className={`px-4 py-1.5 text-xs font-bold rounded-lg ${viewMode === m ? 'bg-white dark:bg-white/20 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 dark:text-white/40'}`}>{m === 'week' ? 'Semaine' : 'Jour'}</button>)}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentDate(viewMode === 'week' ? addWeeks(currentDate, -1) : addDays(currentDate, -1))} className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"><ChevronLeft /></button>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{viewMode === 'week' ? weekLabel : format(currentDate, 'EEEE d MMMM', { locale: fr })}</h2>
            <button onClick={() => setCurrentDate(viewMode === 'week' ? addWeeks(currentDate, 1) : addDays(currentDate, 1))} className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"><ChevronRight /></button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
               <CloudCheck size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">SYNCHRONISÉ</span>
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-white dark:bg-white/10 rounded-2xl border border-gray-100 dark:border-white/10">{isDarkMode ? <Sun className="text-amber-400" /> : <Moon className="text-slate-600" />}</button>
            <button onClick={() => { setEditingTask(null); setIsModalOpen(true); }} className="p-3 bg-[#1e293b] dark:bg-indigo-600 text-white rounded-2xl shadow-lg hover:scale-105 transition-transform"><Plus /></button>
            <button onClick={() => setIsSettingsModalOpen(true)} className="p-3 bg-white dark:bg-white/10 rounded-2xl border border-gray-100 dark:border-white/10 text-slate-400"><Settings /></button>
          </div>
        </header>

        <div className="flex-1 bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] shadow-sm border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden relative">
           <div className="flex border-b border-gray-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 relative z-20">
              <div className="w-20 shrink-0" />
              {displayDates.map((d, i) => (
                <div key={i} className="flex-1 py-4 text-center flex flex-col gap-1 border-r border-gray-100 dark:border-white/5 last:border-0">
                  <span className={`text-[10px] font-black uppercase ${isSameDay(d, new Date()) ? 'text-green-500' : 'text-slate-400'}`}>{DAYS_FR[d.getDay() === 0 ? 6 : d.getDay() - 1]}</span>
                  <span className={`text-sm font-black ${isSameDay(d, new Date()) ? 'text-green-500' : 'text-slate-300 dark:text-white/20'}`}>{format(d, 'd')}</span>
                </div>
              ))}
           </div>
           <div className="flex-1 overflow-y-auto relative flex custom-scrollbar">
              <div className="absolute inset-0 pointer-events-none">
                 <div className="flex h-full">
                    <div className="w-20 shrink-0" />
                    {displayDates.map((_, i) => (<div key={i} className="flex-1 border-r border-slate-200 dark:border-white/10 last:border-0" />))}
                 </div>
                 {TIME_SLOTS.map((_, i) => (<div key={i} className="absolute w-full border-b border-slate-200 dark:border-white/10" style={{ top: i * HOUR_HEIGHT, left: 0, height: 1 }} />))}
              </div>
              <div className="w-20 bg-slate-50/30 dark:bg-white/5 border-r border-gray-200 dark:border-white/10 shrink-0 relative z-10">
                {TIME_SLOTS.map(t => <div key={t} style={{ height: HOUR_HEIGHT }} className="flex justify-center pt-2 text-[10px] font-bold text-slate-300 dark:text-slate-500 uppercase">{t}</div>)}
              </div>
              <div className="flex-1 flex relative z-10">
                {displayDates.map((date, idx) => {
                  const dayStr = formatDate(date);
                  const layout = getLayoutedTasks(tasks.filter(t => t.date === dayStr));
                  return (
                    <div key={idx} onDragOver={e => e.preventDefault()} onDrop={e => {
                      if (!draggedTaskId) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const mins = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
                      const h = Math.min(23, Math.max(0, Math.floor(mins / 60)));
                      const m = Math.floor((mins % 60) / 5) * 5;
                      setTasks(tasks.map(t => t.id === draggedTaskId ? { ...t, date: dayStr, startTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}` } : t));
                      setDraggedTaskId(null);
                    }} className="flex-1 relative">
                      {layout.map(item => {
                        const cat = categories.find(c => c.id === item.task.categoryId) || categories[0];
                        return (
                          <div key={item.task.id} draggable onDragStart={() => setDraggedTaskId(item.task.id)} onDoubleClick={() => { setEditingTask(item.task); setIsModalOpen(true); }} className="absolute rounded-xl p-2 shadow-sm border-2 border-white/50 dark:border-white/10 z-10 cursor-grab active:cursor-grabbing overflow-hidden group transition-transform hover:scale-[1.01]" style={{ top: item.top, height: item.height, left: `${item.left}%`, width: `${item.width}%`, backgroundColor: isDarkMode ? `${cat.color}60` : cat.lightColor }}>
                            <div className="flex flex-col h-full justify-between">
                               <div className="flex flex-col">
                                  <span className="text-[8px] font-black uppercase" style={{ color: isDarkMode ? 'white' : cat.color }}>{cat.name}</span>
                                  <h4 className="text-[11px] font-black leading-tight" style={{ color: isDarkMode ? 'white' : cat.color }}>{item.task.title}</h4>
                               </div>
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
        </div>
      </main>

      {isModalOpen && <TaskModal categories={categories} onClose={() => { setIsModalOpen(false); setEditingTask(null); }} onSubmit={data => { if (editingTask) setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...data } : t)); else setTasks([...tasks, { ...data, id: Math.random().toString(36).substr(2, 9), actualSeconds: 0, isCompleted: false }]); setIsModalOpen(false); }} onDelete={editingTask ? () => { setTasks(tasks.filter(t => t.id !== editingTask.id)); setIsModalOpen(false); } : undefined} taskToEdit={editingTask || undefined} isDarkMode={isDarkMode} onAddCategory={(name, color) => { const id = `cat-${Math.random().toString(36).substr(2, 9)}`; setCategories([...categories, { id, name, color, lightColor: `${color}20` }]); return id; }} onRemoveCategory={id => setCategories(categories.filter(c => c.id !== id))} selectedDate={currentDate} />}
      {isSettingsModalOpen && <SettingsModal userName={currentUser?.name || ''} timezone={currentUser?.timezone || ''} onClose={() => setIsSettingsModalOpen(false)} onLogout={handleLogout} onSave={(n) => { if (currentUser) setCurrentUser({ ...currentUser, name: n }); setIsSettingsModalOpen(false); }} isDarkMode={isDarkMode} generateSyncToken={generateSyncToken} />}
      {isGrowthSelectOpen && <GrowthSelectionModal onSelect={type => { setGrowth(prev => ({ ...prev, type })); setIsGrowthSelectOpen(false); }} isDarkMode={isDarkMode} />}
    </div>
  );
};

const AuthScreen: React.FC<{ initialIsLogin?: boolean, onAuthSuccess: (u: UserProfile) => void, onTokenRestore: (t: string) => boolean, isDarkMode: boolean, onBack: () => void }> = ({ initialIsLogin = false, onAuthSuccess, onTokenRestore, onBack }) => {
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [syncToken, setSyncToken] = useState('');
  const [showSyncRestore, setShowSyncRestore] = useState(false);

  const handleAuth = () => {
    setError('');
    const usersJson = localStorage.getItem('focus_users_db');
    let users: UserProfile[] = usersJson ? JSON.parse(usersJson) : [];

    if (isLogin) {
      if (!email) { setError("Saisissez votre email."); return; }
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user) onAuthSuccess(user);
      else setError("Email non reconnu ici. Utilisez votre Jeton de Sync pour restaurer votre compte.");
    } else {
      if (!name || !email) { setError("Tous les champs sont requis."); return; }
      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existingUser) onAuthSuccess(existingUser);
      else {
        const newUser: UserProfile = { id: Math.random().toString(36).substr(2, 9), name, email, timezone: 'Europe/Paris' };
        users.push(newUser);
        localStorage.setItem('focus_users_db', JSON.stringify(users));
        onAuthSuccess(newUser);
      }
    }
  };

  const handleTokenRestore = () => {
    if (!syncToken) return;
    const success = onTokenRestore(syncToken);
    if (!success) setError("Jeton invalide. Vérifiez que vous avez bien tout copié.");
  };

  return (
    <div className="h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#0a0a0a] p-10 rounded-[3rem] shadow-2xl max-w-md w-full border border-gray-100 dark:border-white/5 flex flex-col gap-6 relative animate-in fade-in zoom-in duration-500">
        <button onClick={onBack} className="absolute top-6 left-6 text-slate-400 hover:text-slate-800 transition-colors"><ChevronLeft /></button>
        <div className="text-center">
          <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{isLogin ? 'CONNEXION' : 'CRÉER UN COMPTE'}</h2>
          <p className="text-slate-400 text-sm mt-2 font-medium leading-relaxed">
            {isLogin ? 'Accédez à vos rendez-vous.' : 'Rejoignez les utilisateurs productifs.'}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {error && <div className="text-red-500 text-[10px] font-black uppercase text-center bg-red-50 p-4 rounded-xl border border-red-100 leading-normal">{error}</div>}
          
          {!showSyncRestore ? (
            <>
              {!isLogin && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">PRÉNOM</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Votre prénom" className="bg-slate-50 dark:bg-white/5 p-4 rounded-[1.25rem] font-bold dark:text-white outline-none ring-indigo-500 focus:ring-2" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">EMAIL</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="votre@email.com" className="bg-slate-50 dark:bg-white/5 p-4 rounded-[1.25rem] font-bold dark:text-white outline-none ring-indigo-500 focus:ring-2" onKeyDown={(e) => e.key === 'Enter' && handleAuth()} />
              </div>
              <button onClick={handleAuth} className="w-full py-5 rounded-[1.25rem] bg-indigo-600 text-white font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest mt-2">{isLogin ? 'ENTRER' : "C'EST PARTI !"}</button>
            </>
          ) : (
            <div className="flex flex-col gap-4 animate-in slide-in-from-bottom duration-300">
               <div className="flex flex-col gap-1.5">
                 <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">JETON DE SYNC</label>
                 <textarea value={syncToken} onChange={e => setSyncToken(e.target.value)} placeholder="Collez ici le jeton généré sur votre autre appareil..." className="bg-slate-50 dark:bg-white/5 p-4 rounded-[1.25rem] font-bold dark:text-white outline-none ring-indigo-500 focus:ring-2 h-32 text-[10px] leading-relaxed resize-none" />
               </div>
               <button onClick={handleTokenRestore} className="w-full py-5 rounded-[1.25rem] bg-emerald-600 text-white font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">RESTAURER MON COMPTE</button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button onClick={() => { setIsLogin(!isLogin); setError(''); setShowSyncRestore(false); }} className="text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em] hover:opacity-70 transition-opacity">
            {isLogin ? "PAS ENCORE DE COMPTE ? S'INSCRIRE" : "DÉJÀ UN COMPTE ? CONNEXION"}
          </button>
          <button onClick={() => { setShowSyncRestore(!showSyncRestore); setError(''); }} className="text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] underline decoration-indigo-200 underline-offset-4 hover:text-indigo-600 transition-colors">
            {showSyncRestore ? "RETOUR À LA CONNEXION" : "RESTAURER DEPUIS UN AUTRE APPAREIL"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SleepDial: React.FC<{ sleep: SleepSchedule, setSleep: (s: SleepSchedule) => void, isDarkMode: boolean }> = ({ sleep, setSleep, isDarkMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'bed' | 'wake' | null>(null);

  const getAngleFromEvent = (e: any) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    return angle;
  };

  const handleMouseMove = useCallback((e: any) => {
    if (!dragging) return;
    const angle = getAngleFromEvent(e);
    const totalMinutes = Math.round((angle / 360) * 1440);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = Math.floor((totalMinutes % 60) / 5) * 5;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    if (dragging === 'bed') setSleep({ ...sleep, bedtime: timeStr });
    else setSleep({ ...sleep, wakeTime: timeStr });
  }, [dragging, sleep, setSleep]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const [bH, bM] = sleep.bedtime.split(':').map(Number);
  const [wH, wM] = sleep.wakeTime.split(':').map(Number);
  const startAngle = (bH * 60 + bM) / 4; 
  const endAngle = (wH * 60 + wM) / 4;
  let diff = endAngle - startAngle;
  if (diff < 0) diff += 360;

  const handlePos = (angle: number) => {
    const rad = (angle - 90) * (Math.PI / 180);
    return { x: 50 + 45 * Math.cos(rad), y: 50 + 45 * Math.sin(rad) };
  };

  const bedPos = handlePos(startAngle);
  const wakePos = handlePos(endAngle);

  return (
    <div ref={containerRef} className="w-48 h-48 rounded-full border-[12px] border-slate-50 dark:border-white/5 relative flex items-center justify-center select-none">
      <svg viewBox="0 0 100 100" className="absolute inset-0">
        <circle cx="50" cy="50" r="45" fill="none" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'} strokeWidth="10" />
        <path d={`M ${bedPos.x} ${bedPos.y} A 45 45 0 ${diff > 180 ? 1 : 0} 1 ${wakePos.x} ${wakePos.y}`} fill="none" stroke="#6366f1" strokeWidth="10" strokeLinecap="round" />
        <circle cx={bedPos.x} cy={bedPos.y} r="6" fill="white" stroke="#6366f1" strokeWidth="2" className="cursor-pointer" onMouseDown={() => setDragging('bed')} onTouchStart={() => setDragging('bed')} />
        <circle cx={wakePos.x} cy={wakePos.y} r="6" fill="white" stroke="#6366f1" strokeWidth="2" className="cursor-pointer" onMouseDown={() => setDragging('wake')} onTouchStart={() => setDragging('wake')} />
      </svg>
      <div className="flex flex-col items-center">
         <div className="flex items-baseline"><span className="text-4xl font-black text-slate-800 dark:text-white">{Math.floor((diff / 360) * 24)}</span><span className="text-xs font-bold text-slate-400 ml-0.5">h</span></div>
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{Math.round(((diff / 360) * 24 % 1) * 60)}min</span>
      </div>
    </div>
  );
};

export default App;
