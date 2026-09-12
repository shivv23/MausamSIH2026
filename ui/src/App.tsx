import { useEffect, useMemo, useState } from 'react';
import { CloudSun, SlidersHorizontal, X, ExternalLink, Smartphone } from "lucide-react";
import { buildHomepage, DEMO_USERS, type UserProfile } from './lib/engine';
import { Phone, type Tab } from './components/Phone';
import { Studio, type DemoState, type StudioTab } from './components/studio/Studio';

const STORAGE_KEY = 'mausam.customProfile';

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
}

export default function App() {
  const vp = useViewport();
  const desktop = vp.w >= 1024;

  const [state, setState] = useState<DemoState>({
    userId: 'ananya',
    cityKey: 'pune',
    scenarioKey: 'auto',
    hour: 'live',
    lang: 'en',
    offline: false,
    onboarding: false,
  });
  const set = (patch: Partial<DemoState>) => setState((s) => ({ ...s, ...patch }));

  const [custom, setCustom] = useState<UserProfile | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  });
  const [tab, setTab] = useState<Tab>('home');
  const [studioTab, setStudioTab] = useState<StudioTab>('controls');
  const [drawer, setDrawer] = useState(false);

  // live clock tick (minute)
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const user = useMemo(() => (state.userId === 'you' && custom ? custom : DEMO_USERS.find((u) => u.id === state.userId) ?? DEMO_USERS[0]), [state.userId, custom]);
  const hour = state.hour === 'live' ? new Date().getHours() : state.hour;

  const hp = useMemo(() => buildHomepage({ user, cityKey: state.cityKey, scenarioKey: state.scenarioKey, hour, lang: state.lang }), [user, state.cityKey, state.scenarioKey, hour, state.lang]);

  const onProfile = (u: UserProfile) => {
    setCustom(u);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch {
      /* ignore */
    }
    set({ userId: 'you', cityKey: u.city, lang: u.language });
  };

  // scale the phone to fit the viewport on desktop
  const scale = desktop ? Math.min(1, (vp.h - 150) / 820) : 1;

  const phone = (
    <Phone
      hp={hp}
      lang={state.lang}
      setLang={(l) => set({ lang: l })}
      offline={state.offline}
      onboarding={state.onboarding}
      setOnboarding={(v) => set({ onboarding: v })}
      onProfile={onProfile}
      framed={desktop}
      tab={tab}
      setTab={setTab}
    />
  );

  if (!desktop) {
    return (
      <div className="fixed inset-0 bg-[#F8FAFE]" style={{ height: '100dvh' }}>
        {phone}
        <button onClick={() => setDrawer(true)} className="fixed bottom-24 right-3 z-50 flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2.5 text-[12px] font-extrabold text-white shadow-2xl shadow-slate-900/40 active:scale-95">
          <SlidersHorizontal size={14} /> Studio
        </button>
        {drawer && (
          <div className="fixed inset-0 z-[60] flex flex-col justify-end">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <div className="sheet-enter relative h-[88dvh] overflow-hidden rounded-t-[28px] bg-[#0b1220] p-2 pt-3">
              <div className="mb-2 flex items-center justify-between px-2">
                <Brand compact />
                <button onClick={() => setDrawer(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white">
                  <X size={15} />
                </button>
              </div>
              <div className="h-[calc(100%-44px)]">
                <Studio state={state} set={(p) => { set(p); if (p.userId || p.scenarioKey || p.cityKey) setDrawer(false); }} hp={hp} tab={studioTab} setTab={setStudioTab} hasCustom={!!custom} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="studio-bg min-h-screen text-white">
      <header className="mx-auto flex max-w-[1500px] items-center justify-between px-6 pt-5">
        <Brand />
        <div className="hidden items-center gap-2 text-[11.5px] font-semibold text-slate-400 md:flex">
          <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">SIH 2026</span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">PS 26076</span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">MoES / IMD</span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">Team BugNotFound</span>
          <a href="https://github.com/shivv23/MausamSIH2026" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-slate-900 transition hover:bg-sky-100">
            <ExternalLink size={13} /> Repo
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] grid-cols-[auto_1fr] gap-8 px-6 pb-8 pt-4" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="flex flex-col items-center justify-center">
          <div style={{ width: 390 * scale, height: 820 * scale }} className="relative">
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>{phone}</div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
            <Smartphone size={12} /> 390 × 844 · React Native reference · {hp.user.name} · {hp.city.name} · {hp.scenario.emoji} {hp.scenario.label} · {String(hp.hour).padStart(2, '0')}:00
          </div>
        </div>
        <div className="min-h-0">
          <Studio state={state} set={set} hp={hp} tab={studioTab} setTab={setStudioTab} hasCustom={!!custom} />
        </div>
      </main>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#1565C0] to-[#38BDF8] shadow-lg shadow-sky-900/40 ring-1 ring-white/20">
        <CloudSun size={22} className="text-white" strokeWidth={2} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[17px] font-extrabold tracking-tight text-white">Mausam 2.0</span>
          <span className="rounded-md bg-sky-400/15 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-sky-300 ring-1 ring-sky-400/30">Design Studio</span>
        </div>
        {!compact && <p className="text-[11.5px] text-slate-400">Personalised weather intelligence — decisions, not data.</p>}
      </div>
    </div>
  );
}
