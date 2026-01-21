
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
  Baby
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
  password?: string;
}

const GROWTH_THRESHOLDS = [0, 50, 150, 400];

// Helper: Format seconds to HH:MM:SS or MM:SS
const formatSeconds = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Helper: Format decimal hours to "1h 30min"
const formatTimeDisplay = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const App: React.FC = () => {
  const [appView, setAppView] = useState<'landing' | 'auth' | 'dashboard'>('landing');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('focus_dark_mode') === 'true');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [growth, setGrowth] = useState<GrowthState>({ type: 'fleur', totalPoints: 0, lastPointsUpdate: formatDate(new Date()), streak: 1 });
  const [isGrowthSelectOpen, setIsGrowthSelectOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
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

  useEffect(() => {
    localStorage.setItem('focus_dark_mode', String(isDarkMode));
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    const savedUser = localStorage.getItem('focus_current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
      setAppView('dashboard');
    }
    setIsAuthLoading(false);
  }, []);

  useEffect(() => {
    clockRef.current = setInterval(() => setNow(new Date()), 60000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const prefix = `focus_${currentUser.id}_`;
    const savedTasks = localStorage.getItem(`${prefix}tasks`);
    const savedTodos = localStorage.getItem(`${prefix}todos`);
    const savedCategories = localStorage.getItem(`${prefix}categories`);
    const savedSleep = localStorage.getItem(`${prefix}sleep`);
    const savedGrowth = localStorage.getItem(`${prefix}growth`);
    
    if (savedTasks) setTasks(JSON.parse(savedTasks));
    if (savedTodos) setTodos(JSON.parse(savedTodos));
    if (savedCategories) setCategories(JSON.parse(savedCategories));
    if (savedSleep) setSleep(JSON.parse(savedSleep));
    if (savedGrowth) setGrowth(JSON.parse(savedGrowth));
    else setIsGrowthSelectOpen(true);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const prefix = `focus_${currentUser.id}_`;
    localStorage.setItem(`${prefix}tasks`, JSON.stringify(tasks));
    localStorage.setItem(`${prefix}todos`, JSON.stringify(todos));
    localStorage.setItem(`${prefix}categories`, JSON.stringify(categories));
    localStorage.setItem(`${prefix}sleep`, JSON.stringify(sleep));
    localStorage.setItem(`${prefix}growth`, JSON.stringify(growth));
  }, [tasks, todos, categories, sleep, growth, currentUser]);

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
  const { label: weekLabel, month: weekMonth } = getDisplayWeek(currentDate);
  const currentWeekId = getWeekId(currentDate);
  const todayStr = formatDate(new Date());
  
  const weeklySummary = categories.map(cat => {
    const filteredTasks = tasks.filter(t => t.categoryId === cat.id && getWeekId(new Date(t.date)) === currentWeekId);
    return { ...cat, actualHours: filteredTasks.reduce((acc, t) => acc + (t.actualSeconds / 3600), 0), plannedHours: filteredTasks.reduce((acc, t) => acc + t.durationHours, 0) };
  });

  const totalWeeklyActual = weeklySummary.reduce((acc, s) => acc + s.actualHours, 0);
  const maxWeeklyHours = Math.max(...weeklySummary.map(s => Math.max(s.actualHours, s.plannedHours)), 1);
  const todaySummary = categories.map(cat => {
    const filtered = tasks.filter(t => t.date === todayStr && t.categoryId === cat.id);
    return { ...cat, planned: filtered.reduce((acc, t) => acc + t.durationHours, 0), actual: filtered.reduce((acc, t) => acc + (t.actualSeconds / 3600), 0) };
  });

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

  if (isAuthLoading) return <div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (appView === 'landing') return <LandingPage onStart={() => setAppView('auth')} onLogin={() => setAppView('auth')} />;
  if (appView === 'auth' && !currentUser) return <AuthScreen onAuthSuccess={user => { setCurrentUser(user); localStorage.setItem('focus_current_user', JSON.stringify(user)); setAppView('dashboard'); }} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)} onBack={() => setAppView('landing')} />;

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-screen bg-[#f1f2f6] dark:bg-black p-4 lg:p-6 overflow-hidden flex`}>
      <aside className="w-80 flex flex-col gap-6 pr-6 border-r border-gray-200 dark:border-white/10 overflow-y-auto custom-scrollbar">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Bonjour {currentUser?.name} 👋</h1>
        <GrowthWidget growth={growth} dailyPoints={dailyPoints} isDarkMode={isDarkMode} onSelect={() => setIsGrowthSelectOpen(true)} />
        <section className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-white/10 flex flex-col gap-6">
          <h3 className="text-slate-800 dark:text-white font-black text-[10px] tracking-widest flex items-center gap-2"><Moon size={16} className="text-indigo-500" /> Sommeil</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 flex flex-col gap-1"><span className="text-indigo-400 font-black text-[9px] uppercase">Coucher</span><span className="text-slate-800 dark:text-white font-black">{sleep.bedtime}</span></div>
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 flex flex-col gap-1 items-end"><span className="text-amber-500 font-black text-[9px] uppercase">Réveil</span><span className="text-slate-800 dark:text-white font-black">{sleep.wakeTime}</span></div>
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
           </div>
        </section>
        <section className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-white/10">
          <h3 className="text-slate-700 dark:text-white font-bold mb-4">To-do du jour</h3>
          <div className="flex flex-col gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg inline-block w-fit" style={{ backgroundColor: isDarkMode ? `${cat.color}30` : cat.lightColor, color: isDarkMode ? 'white' : cat.color }}>{cat.name}</span>
                {todos.filter(t => t.type === 'daily' && t.date === todayStr && t.text.includes(`[${cat.id}]`)).map(todo => (
                  <div key={todo.id} onClick={() => setTodos(todos.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))} className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border transition-colors ${todo.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 dark:border-white/10'}`}>{todo.completed && <CheckCircle2 size={12} />}</div>
                    <span className={`text-xs ${todo.completed ? 'text-slate-400 line-through' : 'text-slate-600 dark:text-white'}`}>{todo.text.replace(`[${cat.id}]`, '').trim()}</span>
                  </div>
                ))}
                <AddInput onAdd={txt => setTodos([...todos, { id: Math.random().toString(36).substr(2, 9), text: `[${cat.id}] ${txt}`, completed: false, type: 'daily', date: todayStr }])} placeholder="Ajouter..." className="text-[10px] h-7" />
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
            <button onClick={() => setCurrentDate(viewMode === 'week' ? subWeeks(currentDate, 1) : subDays(currentDate, 1))} className="p-2 text-slate-400"><ChevronLeft /></button>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{viewMode === 'week' ? weekLabel : format(currentDate, 'EEEE d MMMM', { locale: fr })}</h2>
            <button onClick={() => setCurrentDate(viewMode === 'week' ? addWeeks(currentDate, 1) : addDays(currentDate, 1))} className="p-2 text-slate-400"><ChevronRight /></button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-white dark:bg-white/10 rounded-2xl border border-gray-100 dark:border-white/10">{isDarkMode ? <Sun className="text-amber-400" /> : <Moon className="text-slate-600" />}</button>
            <button onClick={() => { setEditingTask(null); setIsModalOpen(true); }} className="p-3 bg-[#1e293b] dark:bg-indigo-600 text-white rounded-2xl shadow-lg"><Plus /></button>
            <button onClick={() => setIsSettingsModalOpen(true)} className="p-3 bg-white dark:bg-white/10 rounded-2xl border border-gray-100 dark:border-white/10 text-slate-400"><Settings /></button>
          </div>
        </header>

        <div className="flex-1 bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] shadow-sm border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden">
           <div className="flex border-b border-gray-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
              <div className="w-20" />
              {displayDates.map((d, i) => (
                <div key={i} className="flex-1 py-4 text-center flex flex-col gap-1">
                  <span className={`text-[10px] font-black uppercase ${isSameDay(d, new Date()) ? 'text-green-500' : 'text-slate-400'}`}>{DAYS_FR[d.getDay() === 0 ? 6 : d.getDay() - 1]}</span>
                  <span className={`text-sm font-black ${isSameDay(d, new Date()) ? 'text-green-500' : 'text-slate-300 dark:text-white/20'}`}>{format(d, 'd')}</span>
                </div>
              ))}
           </div>
           <div className="flex-1 overflow-y-auto relative flex custom-scrollbar">
              <div className="w-20 bg-slate-50/30 dark:bg-white/5 border-r border-gray-200 dark:border-white/10 shrink-0">
                {TIME_SLOTS.map(t => <div key={t} style={{ height: HOUR_HEIGHT }} className="border-b border-gray-200 dark:border-white/10 flex justify-center pt-2 text-[10px] font-bold text-slate-300 uppercase">{t}</div>)}
              </div>
              <div className="flex-1 flex relative">
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
                    }} className="flex-1 border-r border-gray-100 dark:border-white/5 relative">
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
           <div className="p-6 border-t border-gray-200 dark:border-white/10">
              <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                 {todaySummary.map(item => (
                   <div key={item.id} className="min-w-[240px] p-5 rounded-3xl border flex items-center justify-between" style={{ backgroundColor: isDarkMode ? `${item.color}30` : item.lightColor, borderColor: `${item.color}40` }}>
                      <div className="flex flex-col"><span className="text-[10px] font-black uppercase" style={{ color: isDarkMode ? 'white' : item.color }}>{item.name}</span><span className="text-[10px] font-bold opacity-60" style={{ color: isDarkMode ? 'white' : item.color }}>Prévu: {formatTimeDisplay(item.planned)}</span></div>
                      <div className="flex flex-col items-end"><span className="text-xl font-black" style={{ color: isDarkMode ? 'white' : item.color }}>{formatTimeDisplay(item.actual)}</span><span className="text-[8px] font-black opacity-40 uppercase">RÉEL</span></div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </main>

      {isModalOpen && <TaskModal categories={categories} onClose={() => { setIsModalOpen(false); setEditingTask(null); }} onSubmit={data => { if (editingTask) setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...data } : t)); else setTasks([...tasks, { ...data, id: Math.random().toString(36).substr(2, 9), actualSeconds: 0, isCompleted: false }]); setIsModalOpen(false); }} onDelete={editingTask ? () => { setTasks(tasks.filter(t => t.id !== editingTask.id)); setIsModalOpen(false); } : undefined} taskToEdit={editingTask || undefined} isDarkMode={isDarkMode} onAddCategory={(name, color) => { const id = `cat-${Math.random().toString(36).substr(2, 9)}`; setCategories([...categories, { id, name, color, lightColor: `${color}20` }]); return id; }} onRemoveCategory={id => setCategories(categories.filter(c => c.id !== id))} selectedDate={currentDate} />}
      {isSettingsModalOpen && <SettingsModal userName={currentUser?.name || ''} timezone={currentUser?.timezone || ''} onClose={() => setIsSettingsModalOpen(false)} onLogout={() => { setCurrentUser(null); localStorage.removeItem('focus_current_user'); setAppView('landing'); }} onSave={(n, t) => { if (currentUser) { const u = { ...currentUser, name: n, timezone: t }; setCurrentUser(u); localStorage.setItem('focus_current_user', JSON.stringify(u)); } setIsSettingsModalOpen(false); }} isDarkMode={isDarkMode} />}
      {isGrowthSelectOpen && <GrowthSelectionModal onSelect={type => { setGrowth(prev => ({ ...prev, type })); setIsGrowthSelectOpen(false); }} isDarkMode={isDarkMode} />}
    </div>
  );
};

// Sub-components
const GrowthWidget: React.FC<{ growth: GrowthState, dailyPoints: number, isDarkMode: boolean, onSelect: () => void }> = ({ growth, dailyPoints, isDarkMode, onSelect }) => {
  const stage = growth.totalPoints >= 400 ? 3 : growth.totalPoints >= 150 ? 2 : growth.totalPoints >= 50 ? 1 : 0;
  const Visual = growth.type === 'arbre' ? TreeGrowth : growth.type === 'animal' ? BirdGrowth : growth.type === 'humain' ? BabyGrowth : FlowerGrowth;
  return (
    <section onClick={onSelect} className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-white/10 flex flex-col gap-4 cursor-pointer hover:shadow-md transition-all border-b-4 border-b-emerald-500/10">
      <div className="flex justify-between items-center"><div className="flex flex-col"><span className="text-[10px] font-black uppercase text-slate-400">Points Focus</span><div className="flex items-center gap-1"><Zap size={12} className="text-amber-500 fill-amber-500" /><span className="text-xl font-black text-slate-800 dark:text-white">+{dailyPoints} pts</span></div></div><div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 font-black">{growth.streak}d</div></div>
      <div className="flex items-center gap-4 py-2"><div className="w-16 h-16 shrink-0"><Visual stage={stage} isDarkMode={isDarkMode} /></div><div className="flex-1 flex flex-col gap-1"><p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 italic">"Chaque minute compte."</p><div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, ((growth.totalPoints - (stage === 0 ? 0 : GROWTH_THRESHOLDS[stage])) / ((GROWTH_THRESHOLDS[stage+1] || 1000) - (stage === 0 ? 0 : GROWTH_THRESHOLDS[stage]))) * 100)}%` }} /></div><div className="flex justify-between text-[9px] font-black text-slate-300"><span>Niveau {stage + 1}</span><span>{growth.totalPoints} pts</span></div></div></div>
    </section>
  );
};

const GrowthSelectionModal: React.FC<{ onSelect: (type: GrowthType) => void, isDarkMode: boolean }> = ({ onSelect, isDarkMode }) => {
  const options: { type: GrowthType, label: string, Visual: any, desc: string }[] = [
    { type: 'fleur', label: 'Fleur de Focus', Visual: FlowerGrowth, desc: 'S\'épanouit avec la complétion des tâches.' },
    { type: 'arbre', label: 'Arbre de Vie', Visual: TreeGrowth, desc: 'Grandit avec un sommeil régulier.' },
    { type: 'animal', label: 'Phénix Focus', Visual: BirdGrowth, desc: 'S\'élève avec les sessions de travail profond.' },
    { type: 'humain', label: 'Évolution Humaine', Visual: BabyGrowth, desc: 'Apprend et évolue avec votre discipline.' }
  ];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0a0a0a] rounded-[3rem] p-8 max-w-2xl w-full flex flex-col gap-8 shadow-2xl">
        <h2 className="text-3xl font-black text-slate-800 dark:text-white text-center">Choisissez votre compagnon</h2>
        <div className="grid grid-cols-2 gap-6">
          {options.map(opt => (
            <div key={opt.type} onClick={() => onSelect(opt.type)} className="p-6 rounded-[2rem] border-2 border-slate-50 dark:border-white/5 hover:border-indigo-500 cursor-pointer flex flex-col items-center gap-4 transition-all hover:scale-105 group">
              <div className="w-24 h-24 group-hover:animate-float"><opt.Visual stage={3} isDarkMode={isDarkMode} /></div>
              <div className="text-center"><h3 className="text-lg font-black text-slate-800 dark:text-white">{opt.label}</h3><p className="text-xs text-slate-400 dark:text-white/40">{opt.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TaskModal: React.FC<{ categories: Category[], onClose: () => void, onSubmit: (data: Omit<Task, 'id' | 'actualSeconds' | 'isCompleted'>) => void, onDelete?: () => void, taskToEdit?: Task, isDarkMode: boolean, onAddCategory: (n: string, c: string) => string, onRemoveCategory: (id: string) => void, selectedDate: Date }> = ({ categories, onClose, onSubmit, onDelete, taskToEdit, isDarkMode, onAddCategory, onRemoveCategory, selectedDate }) => {
  const [title, setTitle] = useState(taskToEdit?.title || '');
  const [categoryId, setCategoryId] = useState(taskToEdit?.categoryId || categories[0]?.id || '');
  const [date, setDate] = useState(taskToEdit?.date || formatDate(selectedDate));
  const [startTime, setStartTime] = useState(taskToEdit?.startTime || '09:00');
  const [duration, setDuration] = useState(taskToEdit?.durationHours.toString() || '1');
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] p-8 max-w-md w-full flex flex-col gap-6 shadow-2xl">
        <div className="flex justify-between items-center"><h2 className="text-2xl font-black text-slate-800 dark:text-white">{taskToEdit ? 'Modifier' : 'Ajouter'} une tâche</h2><button onClick={onClose} className="p-2 text-slate-400"><X /></button></div>
        <div className="flex flex-col gap-4">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre..." className="w-full bg-slate-50 dark:bg-white/5 p-4 rounded-2xl outline-none font-bold text-slate-800 dark:text-white focus:ring-2 ring-indigo-500" />
          <div className="grid grid-cols-2 gap-4">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl outline-none font-bold text-slate-800 dark:text-white" />
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl outline-none font-bold text-slate-800 dark:text-white" />
          </div>
          <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
            <span className="text-xs font-black uppercase text-slate-400">Durée (h)</span>
            <input type="number" step="0.25" min="0.25" value={duration} onChange={e => setDuration(e.target.value)} className="bg-transparent outline-none font-black text-slate-800 dark:text-white w-full text-right" />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setCategoryId(cat.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${categoryId === cat.id ? 'shadow-md scale-105' : 'opacity-40 hover:opacity-100'}`} style={{ backgroundColor: cat.color, color: 'white' }}>{cat.name}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-4 mt-4">
          {onDelete && <button onClick={onDelete} className="flex-1 py-4 rounded-2xl bg-red-50 text-red-500 font-black hover:bg-red-100"><Trash2 className="mx-auto" /></button>}
          <button onClick={() => title && onSubmit({ title, categoryId, date, startTime, durationHours: parseFloat(duration) })} className="flex-[3] py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-200">Enregistrer</button>
        </div>
      </div>
    </div>
  );
};

const SettingsModal: React.FC<{ userName: string, timezone: string, onClose: () => void, onLogout: () => void, onSave: (n: string, t: string) => void, isDarkMode: boolean }> = ({ userName, timezone, onClose, onLogout, onSave, isDarkMode }) => {
  const [name, setName] = useState(userName);
  const [tz, setTz] = useState(timezone);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] p-8 max-w-sm w-full flex flex-col gap-8 shadow-2xl">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white">Paramètres</h2>
        <div className="flex flex-col gap-4">
           <div className="flex flex-col gap-1"><span className="text-[10px] font-black uppercase text-slate-400">Nom complet</span><input value={name} onChange={e => setName(e.target.value)} className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl font-bold dark:text-white" /></div>
           <div className="flex flex-col gap-1"><span className="text-[10px] font-black uppercase text-slate-400">Fuseau horaire</span><select value={tz} onChange={e => setTz(e.target.value)} className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl font-bold dark:text-white"><option value="Europe/Paris">Europe/Paris</option><option value="UTC">UTC</option></select></div>
        </div>
        <div className="flex flex-col gap-2"><button onClick={() => onSave(name, tz)} className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black">Enregistrer</button><button onClick={onLogout} className="w-full py-4 rounded-2xl text-red-500 font-black flex items-center justify-center gap-2"><LogOut size={18} /> Déconnexion</button><button onClick={onClose} className="w-full py-4 text-slate-400 font-bold">Fermer</button></div>
      </div>
    </div>
  );
};

const AuthScreen: React.FC<{ onAuthSuccess: (u: UserProfile) => void, isDarkMode: boolean, toggleDarkMode: () => void, onBack: () => void }> = ({ onAuthSuccess, isDarkMode, onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  return (
    <div className="h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#0a0a0a] p-10 rounded-[3rem] shadow-2xl max-w-md w-full border border-gray-100 dark:border-white/5 flex flex-col gap-8 relative overflow-hidden">
        <button onClick={onBack} className="absolute top-6 left-6 text-slate-400 hover:text-slate-800 dark:hover:text-white"><ChevronLeft /></button>
        <div className="text-center"><h2 className="text-3xl font-black text-slate-800 dark:text-white">{isLogin ? 'Bon retour !' : 'Rejoindre Focus'}</h2><p className="text-slate-400 text-sm mt-2">{isLogin ? 'Continuez votre croissance.' : 'Commencez l\'aventure.'}</p></div>
        <div className="flex flex-col gap-4">
          {!isLogin && <input value={name} onChange={e => setName(e.target.value)} placeholder="Prénom" className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl font-bold dark:text-white outline-none ring-indigo-500 focus:ring-2" />}
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl font-bold dark:text-white outline-none ring-indigo-500 focus:ring-2" />
          <button onClick={() => onAuthSuccess({ id: 'u1', name: name || 'Aventurier', email, timezone: 'Europe/Paris' })} className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-200 mt-2">{isLogin ? 'Se connecter' : 'Créer un compte'}</button>
        </div>
        <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-600 font-black text-xs uppercase tracking-widest">{isLogin ? 'Créer un compte' : 'Déjà un compte ?'}</button>
      </div>
    </div>
  );
};

const AddInput: React.FC<{ onAdd: (txt: string) => void, placeholder?: string, className?: string }> = ({ onAdd, placeholder, className }) => {
  const [val, setVal] = useState('');
  return (
    <div className={`relative flex items-center group ${className}`}>
      <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && val) { onAdd(val); setVal(''); } }} placeholder={placeholder} className="w-full bg-slate-100 dark:bg-white/5 rounded-xl px-3 h-full outline-none text-xs font-bold transition-all focus:ring-1 ring-indigo-400 dark:text-white" />
      <button onClick={() => { if (val) { onAdd(val); setVal(''); } }} className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={14} className="text-indigo-500" /></button>
    </div>
  );
};

const SleepDial: React.FC<{ sleep: SleepSchedule, setSleep: (s: SleepSchedule) => void, isDarkMode: boolean }> = ({ sleep, setSleep, isDarkMode }) => {
  const [bH, bM] = sleep.bedtime.split(':').map(Number);
  const [wH, wM] = sleep.wakeTime.split(':').map(Number);
  const startAngle = (bH * 60 + bM) / 4; 
  const endAngle = (wH * 60 + wM) / 4;
  let diff = endAngle - startAngle;
  if (diff < 0) diff += 360;
  return (
    <div className="w-32 h-32 rounded-full border-[10px] border-slate-50 dark:border-white/5 relative flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r="45" fill="none" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'} strokeWidth="10" />
        <path d={`M 50,50 m -45,0 a 45,45 0 1,1 90,0 a 45,45 0 1,1 -90,0`} fill="none" stroke="#6366f1" strokeWidth="10" strokeDasharray={`${(diff/360)*283} 283`} strokeDashoffset={`${-(startAngle/360)*283}`} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white dark:bg-[#1a1a1a] shadow-md border dark:border-white/10 flex items-center justify-center translate-x-3 -translate-y-3"><Bell size={12} className="text-amber-500" /></div>
    </div>
  );
};

export default App;
