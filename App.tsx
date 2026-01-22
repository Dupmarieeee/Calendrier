
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
  ChevronRight as ChevronRightIcon,
  Lock,
  Eye,
  EyeOff,
  Cloud,
  Check,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Category, Task, TodoItem, SleepSchedule, GrowthType, GrowthState } from './types';
import { INITIAL_CATEGORIES, TIME_SLOTS, DAYS_FR } from './constants';
import { getWeekDates, formatDate, getDisplayWeek, getWeekId } from './utils/dateUtils';
import { FlowerGrowth, TreeGrowth, BirdGrowth, BabyGrowth } from './GrowthVisuals';
import LandingPage from './LandingPage';

const HOUR_HEIGHT = 120; 
const MIN_TASK_HEIGHT = 28; 

// Service de synchronisation (Utilisation d'un endpoint persistant basé sur le nom de l'objet)
const CLOUD_ENDPOINT = "https://api.restful-api.dev/objects";

interface UserData {
  tasks: Task[];
  todos: TodoItem[];
  categories: Category[];
  sleep: SleepSchedule;
  growth: GrowthState;
}

interface UserProfile {
  id: string; // ID Cloud permanent
  name: string;
  email: string;
  password?: string;
  timezone: string;
  data: UserData;
}

const GROWTH_THRESHOLDS = [0, 50, 150, 400];

// Utilitaire pour transformer l'email en une clé unique pour le Cloud (SHA-256)
const getEmailKey = async (email: string) => {
  const msgBuffer = new TextEncoder().encode(email.toLowerCase().trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 20);
};

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

// --- WIDGETS ---

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
    <section className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-white/10 flex flex-col gap-3 relative overflow-visible group min-h-[160px]">
      <div className="flex items-center justify-between relative z-10">
        <div className="flex flex-col">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/40">Énergie Focus</h3>
          <div className="flex items-center gap-1 mt-1">
            <Zap size={18} className="text-amber-500 fill-amber-500" />
            <span className="text-3xl font-black text-slate-800 dark:text-white">+{dailyPoints} pts</span>
          </div>
        </div>
        <button onClick={onSelect} className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors shadow-sm">
          <Palette size={18} />
        </button>
      </div>
      <div className="absolute right-0 top-10 w-28 h-28 z-20 pointer-events-none drop-shadow-xl translate-x-2">
        {renderGrowth()}
      </div>
      <div className="mt-auto space-y-1 relative z-10 max-w-[65%]">
        <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_12px_rgba(99,102,241,0.3)]" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400 dark:text-white/30 tracking-widest">
          <span>Niveau {currentStage + 1}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>
    </section>
  );
};

const TaskModal: React.FC<{ 
  categories: Category[], onClose: () => void, onSubmit: (data: any) => void, onDelete?: () => void, 
  taskToEdit?: Task, isDarkMode: boolean, onAddCategory: (n: string, c: string) => string, 
  onRemoveCategory: (id: string) => void, selectedDate: Date 
}> = ({ categories, onClose, onSubmit, onDelete, taskToEdit, isDarkMode, onAddCategory, onRemoveCategory, selectedDate }) => {
  const [title, setTitle] = useState(taskToEdit?.title || '');
  const [catId, setCatId] = useState(taskToEdit?.categoryId || categories[0]?.id || '');
  const [time, setTime] = useState(taskToEdit?.startTime || '09:00');
  
  const initialDuration = taskToEdit?.durationHours || 1;
  const [durH, setDurH] = useState(Math.floor(initialDuration));
  const [durM, setDurM] = useState(Math.round((initialDuration % 1) * 60));

  const [showCatEditor, setShowCatEditor] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

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
            <div className="flex justify-between items-center ml-4 mb-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">CATÉGORIE</label>
              <button onClick={() => setShowCatEditor(!showCatEditor)} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline">{showCatEditor ? 'RETOUR' : 'GÉRER'}</button>
            </div>
            
            {showCatEditor ? (
              <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl flex flex-col gap-3 border border-slate-100 dark:border-white/5">
                <div className="flex gap-2">
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nouvelle catégorie..." className="flex-1 bg-white dark:bg-white/10 p-2 rounded-lg text-xs font-bold outline-none border border-slate-200 dark:border-white/10 dark:text-white" />
                  <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-2 border-white" />
                  <button onClick={() => { if (newCatName) { onAddCategory(newCatName, newCatColor); setNewCatName(''); } }} className="bg-indigo-600 text-white p-2 rounded-lg shadow-md hover:bg-indigo-700"><Plus size={16} /></button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pt-2">
                  {categories.map(c => (
                    <div key={c.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl border-2 border-transparent transition-all" style={{ backgroundColor: isDarkMode ? `${c.color}20` : c.lightColor }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="text-[10px] font-black uppercase tracking-tight" style={{ color: isDarkMode ? 'white' : c.color }}>{c.name}</span>
                      <button onClick={() => onRemoveCategory(c.id)} className="text-red-400 hover:text-red-600 transition-colors ml-1"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                {categories.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => setCatId(c.id)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center gap-2 ${catId === c.id ? 'border-indigo-500 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    style={{ 
                      color: isDarkMode ? 'white' : c.color, 
                      backgroundColor: isDarkMode ? `${c.color}30` : c.lightColor 
                    }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">HEURE</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 ring-indigo-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">DURÉE</label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center bg-slate-50 dark:bg-white/5 rounded-2xl px-3 group focus-within:ring-2 ring-indigo-500 transition-all border border-transparent">
                  <input type="number" min="0" value={durH} onChange={e => setDurH(Number(e.target.value))} className="w-full bg-transparent py-4 font-bold text-slate-800 dark:text-white outline-none text-right" />
                  <span className="text-[10px] font-black text-slate-400 ml-1">H</span>
                </div>
                <div className="flex-1 flex items-center bg-slate-50 dark:bg-white/5 rounded-2xl px-3 group focus-within:ring-2 ring-indigo-500 transition-all border border-transparent">
                  <input type="number" min="0" max="59" step="5" value={durM} onChange={e => setDurM(Number(e.target.value))} className="w-full bg-transparent py-4 font-bold text-slate-800 dark:text-white outline-none text-right" />
                  <span className="text-[10px] font-black text-slate-400 ml-1">M</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          {onDelete && <button onClick={onDelete} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors"><Trash2 size={20} /></button>}
          <button onClick={() => {
            const finalDuration = durH + (durM / 60);
            onSubmit({ title, categoryId: catId, date: formatDate(selectedDate), startTime: time, durationHours: finalDuration });
          }} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-200 dark:shadow-indigo-900/50 hover:scale-[1.02] active:scale-95 transition-all">
            {taskToEdit ? 'Mettre à jour' : 'Créer la tâche'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [appView, setAppView] = useState<'landing' | 'auth' | 'dashboard'>('landing');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('focus_dark_mode') === 'true');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
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
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem('focus_dark_mode', String(isDarkMode));
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Chargement automatique si une session est active sur cet ordi
  useEffect(() => {
    const savedUserId = localStorage.getItem('focus_last_active_user');
    const usersJson = localStorage.getItem('focus_users_db');
    if (savedUserId && usersJson) {
      const users: UserProfile[] = JSON.parse(usersJson);
      const user = users.find(u => u.id === savedUserId);
      if (user) { 
        loadUserData(user);
        setAppView('dashboard'); 
      }
    }
    setIsAuthLoading(false);
  }, []);

  const loadUserData = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.data) {
      setTasks(user.data.tasks || []);
      setTodos(user.data.todos || []);
      setCategories(user.data.categories || INITIAL_CATEGORIES);
      setSleep(user.data.sleep || { enabled: true, bedtime: '23:30', wakeTime: '07:00' });
      setGrowth(user.data.growth || { type: 'fleur', totalPoints: 0, lastPointsUpdate: formatDate(new Date()), streak: 1 });
    }
    setDataLoaded(true);
  };

  // --- LOGIQUE DE SAUVEGARDE CLOUD ---
  const pushToCloud = useCallback(async (user: UserProfile) => {
    if (!user.id || user.id.length < 5) return;
    setIsSyncing(true);
    try {
      await fetch(`${CLOUD_ENDPOINT}/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.email, data: user })
      });
    } catch (e) {
      console.warn("Sync cloud fail", e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser || !dataLoaded) return;
    
    // Sauvegarde locale cache
    const localUsers = JSON.parse(localStorage.getItem('focus_users_db') || '[]');
    const updatedUser = { ...currentUser, data: { tasks, todos, categories, sleep, growth } };
    const idx = localUsers.findIndex((u: any) => u.email === currentUser.email);
    if (idx === -1) localUsers.push(updatedUser); else localUsers[idx] = updatedUser;
    localStorage.setItem('focus_users_db', JSON.stringify(localUsers));

    // Sauvegarde Cloud déboucée
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      pushToCloud(updatedUser);
    }, 3000);
  }, [tasks, todos, categories, sleep, growth, currentUser, dataLoaded, pushToCloud]);

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

  const todaySummary = categories.map(cat => {
    const filtered = tasks.filter(t => t.date === todayStr && t.categoryId === cat.id);
    return { ...cat, planned: filtered.reduce((acc, t) => acc + t.durationHours, 0), actual: filtered.reduce((acc, t) => acc + (t.actualSeconds / 3600), 0) };
  });

  const totalTodayPlanned = todaySummary.reduce((acc, s) => acc + s.planned, 0);

  const maxWeeklyHours = Math.max(...weeklySummary.map(s => Math.max(s.actualHours, s.plannedHours)), 1);

  const getLayoutedTasks = useCallback((dayTasks: Task[]) => {
    if (dayTasks.length === 0) return [];
    return dayTasks.map(t => {
      const [h, m] = t.startTime.split(':').map(Number);
      const top = (h * HOUR_HEIGHT) + ((m / 60) * HOUR_HEIGHT);
      const height = Math.max(t.durationHours * HOUR_HEIGHT, MIN_TASK_HEIGHT);
      return { task: t, top, height, left: 0, width: 99.5 };
    });
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('focus_last_active_user');
    setAppView('landing');
    setDataLoaded(false);
  }, []);

  if (isAuthLoading) return <div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (appView === 'landing') return <LandingPage onStart={() => setAppView('auth')} onLogin={() => setAppView('auth')} />;
  if (appView === 'auth' && !currentUser) return (
    <AuthScreen 
      onAuthSuccess={user => { 
        loadUserData(user);
        localStorage.setItem('focus_last_active_user', user.id); 
        setAppView('dashboard'); 
      }} 
      onBack={() => setAppView('landing')} 
      isDarkMode={isDarkMode}
    />
  );

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-screen bg-[#f1f2f6] dark:bg-black p-4 lg:p-6 overflow-hidden flex`}>
      {/* SIDEBAR */}
      <aside className="w-80 flex flex-col gap-6 pr-6 border-r border-gray-200 dark:border-white/10 overflow-y-auto custom-scrollbar shrink-0">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Bonjour {currentUser?.name} 👋</h1>
        
        <GrowthWidget growth={growth} dailyPoints={dailyPoints} isDarkMode={isDarkMode} onSelect={() => setIsGrowthSelectOpen(true)} />
        
        <section className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-white/10 flex flex-col gap-6">
          <h3 className="text-slate-800 dark:text-white font-black text-[10px] tracking-widest flex items-center gap-2"><Moon size={16} className="text-indigo-500" /> Sommeil</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 flex flex-col gap-1 items-start border border-indigo-50 dark:border-indigo-900/20 shadow-sm">
              <span className="text-indigo-400 font-black text-[9px] uppercase tracking-widest">Coucher</span>
              <span className="text-slate-800 dark:text-white font-black">{sleep.bedtime}</span>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 flex flex-col gap-1 items-end border border-amber-50 dark:border-amber-900/20 shadow-sm">
              <span className="text-amber-500 font-black text-[9px] uppercase tracking-widest">Réveil</span>
              <span className="text-slate-800 dark:text-white font-black">{sleep.wakeTime}</span>
            </div>
          </div>
          <div className="relative flex items-center justify-center py-4 scale-90">
             <SleepDial sleep={sleep} setSleep={setSleep} isDarkMode={isDarkMode} />
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
           </div>
        </section>

        <section className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-white/10 flex flex-col gap-4">
          <h3 className="text-slate-700 dark:text-white font-black text-[10px] uppercase tracking-widest">To-do du jour</h3>
          <div className="flex flex-col gap-4">
            {categories.map(cat => {
              const catTodos = todos.filter(t => t.date === todayStr && t.text.includes(`[${cat.id}]`));
              return (
                <div key={cat.id} className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block w-fit" style={{ backgroundColor: isDarkMode ? `${cat.color}30` : cat.lightColor, color: isDarkMode ? 'white' : cat.color }}>{cat.name}</span>
                  {catTodos.map(todo => (
                    <div key={todo.id} onClick={() => setTodos(todos.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))} className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${todo.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 dark:border-white/10'}`}>{todo.completed && <CheckCircle2 size={12} />}</div>
                      <span className={`text-[11px] font-medium transition-all ${todo.completed ? 'text-slate-300 line-through' : 'text-slate-600 dark:text-white/80'}`}>{todo.text.replace(`[${cat.id}]`, '').trim()}</span>
                    </div>
                  ))}
                  <div className="relative group h-7">
                    <input 
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.currentTarget.value) {
                          setTodos([...todos, { id: Math.random().toString(36).substr(2, 9), text: `[${cat.id}] ${e.currentTarget.value}`, completed: false, type: 'daily', date: todayStr }]);
                          e.currentTarget.value = '';
                        }
                      }}
                      placeholder="Ajouter..." 
                      className="w-full h-full bg-slate-50 dark:bg-white/5 rounded-lg px-2 text-[10px] font-bold outline-none border border-transparent focus:border-indigo-400 dark:text-white"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </aside>

      {/* MAIN CALENDAR */}
      <main className="flex-1 flex flex-col gap-6 ml-6 overflow-hidden">
        <header className="flex items-center justify-between h-14">
          <div className="bg-slate-100 dark:bg-white/10 rounded-xl p-1 flex">
            {['week', 'day'].map(m => <button key={m} onClick={() => setViewMode(m as any)} className={`px-4 py-1.5 text-xs font-bold rounded-lg ${viewMode === m ? 'bg-white dark:bg-white/20 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 dark:text-white/40'}`}>{m === 'week' ? 'Semaine' : 'Jour'}</button>)}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentDate(viewMode === 'week' ? addWeeks(currentDate, -1) : addDays(currentDate, -1))} className="p-2 text-slate-400 hover:text-indigo-500"><ChevronLeft /></button>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{viewMode === 'week' ? weekLabel : format(currentDate, 'EEEE d MMMM', { locale: fr })}</h2>
            <button onClick={() => setCurrentDate(viewMode === 'week' ? addWeeks(currentDate, 1) : addDays(currentDate, 1))} className="p-2 text-slate-400 hover:text-indigo-500"><ChevronRight /></button>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
               {isSyncing ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}
               <span className="text-[10px] font-black uppercase tracking-widest">{isSyncing ? 'SYNC EN COURS...' : 'SYNCHRONISÉ'}</span>
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-white dark:bg-white/10 rounded-2xl border border-gray-100 dark:border-white/10">{isDarkMode ? <Sun className="text-amber-400" /> : <Moon className="text-slate-600" />}</button>
            <button onClick={() => { setEditingTask(null); setIsModalOpen(true); }} className="p-3 bg-[#1e293b] dark:bg-indigo-600 text-white rounded-2xl shadow-lg hover:scale-105 transition-transform"><Plus /></button>
            <button onClick={() => setIsSettingsModalOpen(true)} className="p-3 bg-white dark:bg-white/10 rounded-2xl border border-gray-100 dark:border-white/10 text-slate-400"><Settings /></button>
          </div>
        </header>

        <div className="flex-1 bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] shadow-sm border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden relative">
           <div className="flex border-b border-gray-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 relative z-20">
              <div className="w-20 shrink-0" />
              {displayDates.map((d, i) => {
                const isToday = isSameDay(d, new Date());
                return (
                  <div key={i} className="flex-1 py-4 text-center flex flex-col gap-1 border-r border-gray-100 dark:border-white/5 last:border-0 items-center">
                    <span className={`text-[10px] font-black uppercase ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>{DAYS_FR[d.getDay() === 0 ? 6 : d.getDay() - 1]}</span>
                    {isToday ? (
                      <div className="relative">
                         <div className="absolute inset-0 bg-indigo-500/25 rounded-full scale-[1.6] blur-md animate-pulse"></div>
                         <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-black shadow-lg shadow-indigo-300 dark:shadow-indigo-900/50 relative z-10">{format(d, 'd')}</span>
                      </div>
                    ) : (
                      <span className="text-sm font-black text-slate-300 dark:text-white/20">{format(d, 'd')}</span>
                    )}
                  </div>
                );
              })}
           </div>
           <div className="flex-1 overflow-y-auto relative flex custom-scrollbar">
              <div className="absolute inset-0 pointer-events-none">
                 <div className="flex h-full">
                    <div className="w-20 shrink-0" />
                    {displayDates.map((_, i) => (<div key={i} className="flex-1 border-r border-slate-300 dark:border-white/15 last:border-0" />))}
                 </div>
                 {TIME_SLOTS.map((_, i) => (<div key={i} className="absolute w-full border-b border-slate-300 dark:border-white/15" style={{ top: i * HOUR_HEIGHT, left: 0, height: 1 }} />))}
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
                          <div key={item.task.id} draggable onDragStart={() => setDraggedTaskId(item.task.id)} onDoubleClick={() => { setEditingTask(item.task); setIsModalOpen(true); }} className="absolute rounded-xl p-2 shadow-sm border-2 border-white/50 dark:border-white/10 z-10 cursor-grab active:cursor-grabbing overflow-hidden group transition-transform" style={{ top: item.top, height: item.height, left: `${item.left}%`, width: `${item.width}%`, backgroundColor: isDarkMode ? `${cat.color}60` : cat.lightColor }}>
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

           {/* TODAY SUMMARY FOOTER */}
           <div className="p-6 border-t border-slate-100 dark:border-white/10 bg-white dark:bg-[#0a0a0a] z-30">
              <div className="flex flex-col gap-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                       <BarChart size={16} className="text-indigo-500" />
                       Aujourd'hui – {format(new Date(), 'EEEE', { locale: fr })}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Total : {totalTodayPlanned}h planifiés</p>
                 </div>
                 <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2 no-scrollbar">
                    {todaySummary.map((s, i) => (
                      <div key={i} className="min-w-[210px] p-5 rounded-[2rem] border-2 border-transparent flex items-center justify-between group cursor-pointer shadow-sm hover:scale-[1.02] transition-all hover:shadow-lg active:scale-95" style={{ backgroundColor: isDarkMode ? `${s.color}25` : s.lightColor }}>
                         <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                               <span className="text-[9px] font-black uppercase tracking-widest leading-none" style={{ color: isDarkMode ? 'white' : s.color }}>{s.name}</span>
                               <ChevronRightIcon size={10} style={{ color: isDarkMode ? 'white' : s.color }} className="opacity-40" />
                            </div>
                            <span className="text-[10px] font-bold opacity-60 mt-2" style={{ color: isDarkMode ? 'white' : s.color }}>Planifié: {s.planned}h</span>
                         </div>
                         <div className="flex flex-col items-end">
                            <span className="text-2xl font-black" style={{ color: isDarkMode ? 'white' : s.color }}>{formatTimeDisplay(s.actual)}</span>
                            <span className="text-[8px] font-black opacity-30 uppercase tracking-tighter" style={{ color: isDarkMode ? 'white' : s.color }}>RÉEL</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </main>

      {/* MODALS */}
      {isModalOpen && <TaskModal categories={categories} onClose={() => { setIsModalOpen(false); setEditingTask(null); }} onSubmit={data => { if (editingTask) setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...data } : t)); else setTasks([...tasks, { ...data, id: Math.random().toString(36).substr(2, 9), actualSeconds: 0, isCompleted: false }]); setIsModalOpen(false); }} onDelete={editingTask ? () => { setTasks(tasks.filter(t => t.id !== editingTask.id)); setIsModalOpen(false); } : undefined} taskToEdit={editingTask || undefined} isDarkMode={isDarkMode} onAddCategory={(name, color) => { const id = `cat-${Math.random().toString(36).substr(2, 9)}`; setCategories([...categories, { id, name, color, lightColor: `${color}20` }]); return id; }} onRemoveCategory={id => setCategories(categories.filter(c => c.id !== id))} selectedDate={currentDate} />}
      {isSettingsModalOpen && <SettingsModal userName={currentUser?.name || ''} userEmail={currentUser?.email || ''} onClose={() => setIsSettingsModalOpen(false)} onLogout={handleLogout} onSave={(n) => { if (currentUser) setCurrentUser({ ...currentUser, name: n }); setIsSettingsModalOpen(false); }} />}
      {isGrowthSelectOpen && <GrowthSelectionModal onSelect={type => { setGrowth(prev => ({ ...prev, type })); setIsGrowthSelectOpen(false); }} isDarkMode={isDarkMode} />}
    </div>
  );
};

// --- SETTINGS MODAL ---

const SettingsModal: React.FC<{ 
  userName: string, 
  userEmail: string,
  onClose: () => void, 
  onLogout: () => void, 
  onSave: (name: string) => void
}> = ({ userName, userEmail, onClose, onLogout, onSave }) => {
  const [name, setName] = useState(userName);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-md rounded-[3rem] p-8 shadow-2xl border border-white/10 flex flex-col gap-6 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Paramètres</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"><X /></button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">PROFIL</label>
            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nom</label>
                <input value={name} onChange={setName ? (e) => setName(e.target.value) : undefined} placeholder="Votre nom" className="bg-white dark:bg-white/5 p-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none border border-slate-100 dark:border-white/10" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email (Synchronisation)</label>
                <div className="bg-slate-100 dark:bg-black/20 p-3 rounded-xl font-bold text-slate-400 cursor-not-allowed text-xs">{userEmail}</div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-500/10">
             <div className="flex items-center gap-2 mb-2">
                <Cloud size={16} className="text-indigo-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Compte Multi-Appareils</span>
             </div>
             <p className="text-[10px] font-medium text-indigo-600/80 dark:text-indigo-300/60 leading-relaxed">
               Vos données sont liées à votre email. Vous pouvez vous connecter sur n'importe quel ordinateur pour retrouver vos rendez-vous instantanément.
             </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <button onClick={() => onSave(name)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-200 dark:shadow-indigo-900/50 hover:scale-[1.02] active:scale-95 transition-all">
            Enregistrer les modifications
          </button>
          <button onClick={onLogout} className="w-full py-4 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-100 transition-colors">
            <LogOut size={18} /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
};

// --- AUTH SCREEN ---

const AuthScreen: React.FC<{ 
  onAuthSuccess: (u: UserProfile) => void, 
  isDarkMode: boolean, 
  onBack: () => void 
}> = ({ onAuthSuccess, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'email' | 'password' | 'signup'>('email');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // LOGIQUE CRUCIALE : RECONNAISSANCE GLOBALE PAR EMAIL
  const handleCheckEmail = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) { setError("Veuillez entrer un email valide."); return; }
    
    setIsChecking(true);
    try {
      const emailKey = await getEmailKey(cleanEmail);
      
      // On tente de récupérer l'objet Cloud par son ID dérivé du mail
      const response = await fetch(`${CLOUD_ENDPOINT}/${emailKey}`);
      
      if (response.ok) {
        // Le compte existe GLOBALEMENT -> passage direct au mot de passe
        setStep('password');
      } else {
        // Le compte n'existe pas encore -> inscription
        setStep('signup');
      }
    } catch (err) {
      console.warn("Check error", err);
      // Fallback local si le réseau fail
      const localUsers = JSON.parse(localStorage.getItem('focus_users_db') || '[]');
      const user = localUsers.find((u: any) => u.email.toLowerCase() === cleanEmail);
      setStep(user ? 'password' : 'signup');
    } finally {
      setIsChecking(false);
    }
  };

  const handleAuth = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const cleanEmail = email.toLowerCase().trim();
    
    try {
      setIsChecking(true);
      const emailKey = await getEmailKey(cleanEmail);

      if (step === 'password') {
        // CONNEXION
        const response = await fetch(`${CLOUD_ENDPOINT}/${emailKey}`);
        if (response.ok) {
          const cloudObj = await response.json();
          const user: UserProfile = cloudObj.data;
          
          if (user.password === password) {
            // Mise en cache locale
            const localUsers = JSON.parse(localStorage.getItem('focus_users_db') || '[]');
            const idx = localUsers.findIndex((u: any) => u.email === cleanEmail);
            if (idx === -1) localUsers.push(user); else localUsers[idx] = user;
            localStorage.setItem('focus_users_db', JSON.stringify(localUsers));
            
            onAuthSuccess(user);
          } else {
            setError("Mot de passe incorrect.");
          }
        } else {
          setError("Erreur de récupération du compte.");
        }
      } else {
        // INSCRIPTION
        if (!name || !password) { setError("Veuillez remplir tous les champs."); setIsChecking(false); return; }
        
        const newUser: UserProfile = { 
          id: emailKey, 
          name, 
          email: cleanEmail, 
          password, 
          timezone: 'Europe/Paris',
          data: {
            tasks: [],
            todos: [],
            categories: INITIAL_CATEGORIES,
            sleep: { enabled: true, bedtime: '23:30', wakeTime: '07:00' },
            growth: { type: 'fleur', totalPoints: 0, lastPointsUpdate: formatDate(new Date()), streak: 1 }
          }
        };

        // Envoi au Cloud (Création)
        // restful-api.dev : PUT sur un ID inexistant le crée
        await fetch(`${CLOUD_ENDPOINT}/${emailKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: cleanEmail, data: newUser })
        });

        // Cache local
        const localUsers = JSON.parse(localStorage.getItem('focus_users_db') || '[]');
        localUsers.push(newUser);
        localStorage.setItem('focus_users_db', JSON.stringify(localUsers));
        
        onAuthSuccess(newUser);
      }
    } catch (err) {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#0a0a0a] p-10 rounded-[4rem] shadow-2xl max-w-md w-full border border-gray-100 dark:border-white/5 flex flex-col gap-6 relative animate-in fade-in zoom-in duration-500">
        <button onClick={() => step === 'email' ? onBack() : setStep('email')} className="absolute top-10 left-10 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronLeft /></button>
        
        <div className="text-center space-y-2 pt-6">
          <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
            {step === 'email' ? 'Bienvenue' : step === 'password' ? 'Déverrouiller' : 'Votre Profil'}
          </h2>
          <p className="text-slate-400 text-sm font-medium">
            {step === 'email' ? 'Connectez-vous pour retrouver vos données partout.' : step === 'password' ? 'Entrez votre mot de passe Cloud.' : "Finalisez votre inscription."}
          </p>
        </div>

        <form onSubmit={step === 'email' ? handleCheckEmail : handleAuth} className="flex flex-col gap-5">
          {error && (
            <div className="text-red-500 text-[10px] font-black uppercase text-center bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-500/20 flex items-center gap-2 justify-center">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">EMAIL</label>
            <div className="relative">
              <input 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                type="email" 
                disabled={step !== 'email' || isChecking}
                placeholder="votre@email.com" 
                className={`w-full p-4 rounded-[1.5rem] font-bold outline-none border border-transparent transition-all shadow-sm ${step === 'email' ? 'bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:border-indigo-500' : 'bg-slate-100 dark:bg-white/10 text-slate-400'}`} 
              />
              {step !== 'email' && !isChecking && <button type="button" onClick={() => setStep('email')} className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-500 uppercase">Modifier</button>}
            </div>
          </div>

          {step === 'signup' && (
            <div className="flex flex-col gap-1.5 animate-in slide-in-from-top duration-300">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">PRÉNOM</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Votre prénom" className="bg-slate-50 dark:bg-white/5 p-4 rounded-[1.5rem] font-bold text-slate-900 dark:text-white outline-none border border-transparent focus:border-indigo-500 transition-all shadow-sm" />
            </div>
          )}

          {step !== 'email' && (
            <div className="flex flex-col gap-1.5 animate-in slide-in-from-top duration-300">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">
                MOT DE PASSE
              </label>
              <div className="relative">
                <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="••••••••" className="w-full bg-slate-50 dark:bg-white/5 p-4 rounded-[1.5rem] font-bold text-slate-900 dark:text-white outline-none border border-transparent focus:border-indigo-500 transition-all shadow-sm" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isChecking}
            className="w-full py-5 rounded-[1.5rem] bg-indigo-600 text-white font-black shadow-[0_15px_35px_rgba(79,70,229,0.3)] hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isChecking ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : step === 'email' ? (
              <>CONTINUER <ChevronRightIcon size={16} /></>
            ) : step === 'password' ? (
              <><Lock size={16} /> SE CONNECTER</>
            ) : (
              <><Check size={16} /> CRÉER MON COMPTE</>
            )}
          </button>
        </form>

        <div className="flex flex-col items-center gap-4 pt-2">
          <div className="flex items-center gap-2 opacity-60">
             <Cloud size={14} className="text-indigo-500" />
             <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest text-center">
               Synchronisation Cloud instantanée activée.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- CADRAN DE SOMMEIL ---

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
        <g transform={`translate(${bedPos.x - 4}, ${bedPos.y - 4})`} onMouseDown={() => setDragging('bed')} onTouchStart={() => setDragging('bed')} className="cursor-pointer">
           <circle cx="4" cy="4" r="7" fill="white" stroke="#6366f1" strokeWidth="2" />
           <Moon size={8} className="text-indigo-600 absolute translate-x-[2px] translate-y-[2px]" />
        </g>
        <circle cx={wakePos.x} cy={wakePos.y} r="6" fill="white" stroke="#6366f1" strokeWidth="2" className="cursor-pointer shadow-lg" onMouseDown={() => setDragging('wake')} onTouchStart={() => setDragging('wake')} />
      </svg>
      <div className="flex flex-col items-center">
         <div className="flex items-baseline"><span className="text-4xl font-black text-slate-800 dark:text-white">{Math.floor((diff / 360) * 24)}</span><span className="text-xs font-bold text-slate-400 ml-0.5">h</span></div>
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{Math.round(((diff / 360) * 24 % 1) * 60)}min</span>
      </div>
      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow-md border dark:border-white/10 flex items-center justify-center translate-x-3 -translate-y-3">
         <Bell size={12} className="text-amber-500" />
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
      <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-xl rounded-[4rem] p-10 shadow-2xl border border-white/10 flex flex-col gap-8 items-center text-center animate-in zoom-in-95 duration-500">
        <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Choisissez votre compagnon</h2>
        <div className="grid grid-cols-2 gap-4 w-full">
           {options.map(opt => (
             <button key={opt.type} onClick={() => onSelect(opt.type)} className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2.5rem] flex flex-col items-center gap-3 border border-transparent hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group">
                <div className={`w-14 h-14 rounded-[1.5rem] bg-white dark:bg-white/10 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform ${opt.color}`}>{opt.icon}</div>
                <span className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px]">{opt.name}</span>
             </button>
           ))}
        </div>
      </div>
    </div>
  );
};

export default App;
