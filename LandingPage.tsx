
import React from 'react';
import { 
  ArrowRight, 
  Zap, 
  Moon, 
  LayoutGrid,
  Clock,
  ChevronRight,
  Plus,
  Bell,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Settings,
  Sun,
  BarChart,
  BarChart3
} from 'lucide-react';
import { FlowerGrowth } from './GrowthVisuals';

interface LandingPageProps {
  onStart: () => void;
  onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onLogin }) => {
  return (
    <div className="bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-xl tracking-tight text-indigo-600">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
              <LayoutGrid className="text-white" size={18} />
            </div>
            FocusCalendar
          </div>
          
          <div className="flex items-center gap-4 lg:gap-8">
            <div className="hidden md:flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-500 mr-2">
              <a href="#blog" className="hover:text-indigo-600 transition-colors">BLOG</a>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={onLogin} 
                className="bg-indigo-50 text-indigo-600 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all"
              >
                CONNEXION
              </button>
              <button 
                onClick={onStart} 
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
              >
                S'INSCRIRE
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 lg:pt-40 pb-24 px-6 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
          
          {/* Hero Content */}
          <div className="w-full lg:w-[40%] space-y-8 animate-in fade-in slide-in-from-left duration-700 z-10">
            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 leading-[1.15] tracking-tight text-left">
              Gérez votre temps, <br/>
              <span className="text-indigo-600">cultivez</span> votre potentiel.
            </h1>
            <p className="text-base lg:text-lg text-slate-500 font-medium leading-relaxed text-left max-w-[400px]">
              Le premier calendrier intelligent qui transforme votre productivité en croissance réelle. Suivez vos tâches, optimisez votre sommeil et voyez votre compagnon évoluer.
            </p>
            <div className="pt-2 text-left">
              <button 
                onClick={onStart} 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_15px_35px_rgba(79,70,229,0.35)] flex items-center justify-center gap-2 border-b-4 border-indigo-800/50"
              >
                COMMENCER L'AVENTURE <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* DASHBOARD MOCKUP - ENLARGED */}
          <div className="w-full lg:w-[60%] relative animate-in fade-in slide-in-from-right duration-1000 flex justify-end">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-50 rounded-full blur-[100px] opacity-40 -z-10"></div>
            
            <div className="bg-[#f3f4f6] rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden flex flex-row text-left aspect-[16/10] p-4 lg:p-6 gap-6 scale-95 lg:scale-[0.85] origin-right lg:-mr-16">
              
              <aside className="w-64 lg:w-72 flex flex-col gap-6 shrink-0">
                <header>
                  <h2 className="text-xl font-black text-slate-800">Bonjour marie 👋</h2>
                </header>

                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Énergie Focus</h3>
                      <div className="flex items-center gap-1">
                        <Zap size={14} className="text-amber-500 fill-amber-500" />
                        <span className="text-xl font-black text-slate-800">+20 pts</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 text-[10px] font-black">1d</div>
                  </div>
                  <div className="flex flex-col items-center gap-2 py-1">
                    <p className="text-[11px] font-bold text-slate-500 italic text-center">"La régularité est ta force."</p>
                    <div className="w-8 h-8">
                       <FlowerGrowth stage={1} isDarkMode={false} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[5%] shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                    </div>
                    <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-300">
                      <span>Niveau 1</span>
                      <span>0%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col gap-5">
                   <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                     <Moon size={14} className="text-indigo-500" /> Sommeil
                   </h3>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-2xl p-3 flex flex-col gap-0.5 border border-indigo-50">
                        <span className="text-indigo-400 font-black text-[8px] uppercase tracking-widest">Coucher</span>
                        <span className="text-slate-800 text-lg font-black">23:30</span>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-3 flex flex-col gap-0.5 border border-amber-50 items-end">
                        <span className="text-amber-500 font-black text-[8px] uppercase tracking-widest">Réveil</span>
                        <span className="text-slate-800 text-lg font-black">07:00</span>
                      </div>
                   </div>
                   <div className="flex justify-center py-2 relative">
                      <div className="w-32 h-32 rounded-full border-[10px] border-slate-50 relative flex items-center justify-center">
                         <div className="absolute inset-0 rounded-full border-[10px] border-indigo-100 border-r-transparent border-b-transparent rotate-45" />
                         <div className="flex flex-col items-center">
                            <div className="flex items-baseline">
                               <span className="text-3xl font-black text-slate-800">7</span>
                               <span className="text-xs font-bold text-slate-400 uppercase ml-0.5">H</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">30min</span>
                         </div>
                         <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center translate-x-3 -translate-y-3">
                            <Bell size={12} className="text-amber-500" />
                         </div>
                      </div>
                   </div>
                </div>
              </aside>

              <main className="flex-1 flex flex-col gap-6 overflow-hidden">
                <header className="flex items-center justify-between bg-white rounded-[1.75rem] p-3 border border-slate-200 shadow-sm">
                   <div className="flex items-center bg-slate-100 rounded-xl p-0.5">
                      <div className="px-5 py-2 bg-white text-[10px] font-black rounded-lg text-slate-800 shadow-sm">Semaine</div>
                      <div className="px-5 py-2 text-[10px] font-black text-slate-400">Jour</div>
                   </div>
                   
                   <div className="flex items-center gap-6">
                      <ChevronLeft size={16} className="text-slate-300" />
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Semaine 04 <span className="text-slate-200 mx-1">•</span> Janvier</h2>
                      <ChevronRightIcon size={16} className="text-slate-300" />
                   </div>

                   <div className="flex items-center gap-2">
                      <div className="p-2 border border-slate-200 bg-white rounded-xl text-slate-400"><Moon size={16} /></div>
                      <div className="p-2 bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-200"><Plus size={16} /></div>
                      <div className="p-2 border border-slate-200 bg-white rounded-xl text-slate-400"><Settings size={16} /></div>
                   </div>
                </header>

                <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                   <div className="flex border-b border-slate-100">
                      <div className="w-16 h-14 border-r border-slate-100" />
                      <div className="flex-1 grid grid-cols-7 text-center">
                         {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
                           <div key={i} className="flex flex-col items-center justify-center gap-0 border-r border-slate-50 last:border-0">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{day}</span>
                              {i === 1 ? (
                                <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[11px] font-black shadow-md shadow-emerald-200">20</span>
                              ) : (
                                <span className="text-[11px] font-black text-slate-300">{19 + i}</span>
                              )}
                           </div>
                         ))}
                      </div>
                   </div>

                   <div className="flex-1 overflow-hidden grid grid-cols-[64px_1fr]">
                      <div className="border-r border-slate-100 bg-slate-50/50">
                         {[0, 1, 2].map(h => (
                           <div key={h} className="h-20 border-b border-slate-100 flex items-start justify-center pt-3">
                              <span className="text-[9px] font-black text-slate-300">0{h}:00</span>
                           </div>
                         ))}
                      </div>
                      <div className="grid grid-cols-7 h-full">
                         {Array.from({ length: 7 }).map((_, i) => (
                           <div key={i} className="border-r border-slate-50 last:border-0" />
                         ))}
                      </div>
                   </div>

                   <div className="p-6 border-t border-slate-100 bg-white">
                      <div className="flex flex-col gap-4">
                         <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-800">Aujourd'hui – Mardi</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Total : 0h planifiés</p>
                         </div>
                         <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                            {[
                              { label: 'FORMATION', color: '#c084fc', light: '#f3e8ff' },
                              { label: 'ÉTUDE DE LA CONCURRENCE', color: '#60a5fa', light: '#dbeafe' },
                              { label: 'PROSPECTION', color: '#fbbf24', light: '#fef3c7' },
                              { label: 'RÉSEAUX SOCIAUX', color: '#4ade80', light: '#dcfce7' }
                            ].map((cat, idx) => (
                              <div key={idx} className="min-w-[190px] p-4 rounded-2xl border border-white flex items-center justify-between group cursor-pointer shadow-sm hover:scale-[1.02] transition-transform" style={{ backgroundColor: cat.light }}>
                                 <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                       <span className="text-[8px] font-black uppercase tracking-widest leading-none" style={{ color: cat.color }}>{cat.label}</span>
                                       <ChevronRight size={10} style={{ color: cat.color }} className="opacity-40" />
                                    </div>
                                    <span className="text-[9px] font-bold opacity-60 mt-1" style={{ color: cat.color }}>Prévu: 0h</span>
                                 </div>
                                 <div className="flex flex-col items-end">
                                    <span className="text-xl font-black" style={{ color: cat.color }}>0h</span>
                                    <span className="text-[7px] font-black opacity-30 uppercase tracking-tighter" style={{ color: cat.color }}>RÉEL</span>
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </section>

      {/* Avantages Section */}
      <section id="avantages" className="py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">Pourquoi FocusCalendar ?</h2>
            <p className="text-4xl lg:text-5xl font-black text-slate-900">Plus qu'un simple outil, <br/>une philosophie de vie.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              { 
                icon: <Zap className="text-amber-500" />, 
                title: "Gamification du Focus", 
                desc: "Gagnez des points d'énergie pour chaque minute de travail profond. Voyez votre avatar évoluer de bébé à maître de la sagesse." 
              },
              { 
                icon: <Moon className="text-indigo-500" />, 
                title: "Optimisation Sommeil", 
                desc: "Un esprit reposé est un esprit productif. Notre cadran de sommeil intuitif vous aide à maintenir une routine saine." 
              },
              { 
                icon: <BarChart3 className="text-emerald-500" />, 
                title: "Analytiques de Performance", 
                desc: "Visualisez exactement où va votre temps avec nos graphiques de catégories automatiques. Identifiez vos leviers de croissance." 
              }
            ].map((adv, i) => (
              <div key={i} className="bg-white p-10 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-slate-100 group">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {adv.icon}
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-4">{adv.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{adv.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section id="blog" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-16">
            <div className="space-y-4">
               <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">Le Mag' Focus</h2>
               <p className="text-4xl font-black text-slate-900">Conseils d'experts.</p>
            </div>
            <button className="hidden sm:flex items-center gap-2 text-indigo-600 font-black uppercase tracking-widest text-xs hover:underline decoration-2 underline-offset-8">
              VOIR TOUS LES ARTICLES <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                category: "Productivité", 
                title: "La méthode des 25 minutes : Mythe ou réalité ?", 
                img: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&q=80&w=500" 
              },
              { 
                category: "Sommeil", 
                title: "Pourquoi le réveil à 7h change tout pour votre cerveau", 
                img: "https://images.unsplash.com/photo-1512428559083-a4051ba836c0?auto=format&fit=crop&q=80&w=500" 
              },
              { 
                category: "Gamification", 
                title: "Comment transformer l'ennui des tâches en un jeu épique", 
                img: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=500" 
              }
            ].map((post, i) => (
              <div key={i} className="group cursor-pointer">
                <div className="relative h-64 rounded-[2rem] overflow-hidden mb-6 shadow-lg">
                  <img src={post.img} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute top-4 left-4 bg-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">
                    {post.category}
                  </div>
                </div>
                <h4 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug text-left">
                  {post.title}
                </h4>
                <div className="mt-4 flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <Clock size={14} /> 5 min de lecture
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-100 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-2 font-black text-xl tracking-tight text-indigo-600 opacity-60">
            <LayoutGrid size={24} /> FocusCalendar
          </div>
          <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <a href="#" className="hover:text-indigo-600 transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">CGU</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Contact</a>
          </div>
          <p className="text-xs font-bold text-slate-400">© 2024 FocusCalendar. Fait avec passion.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
