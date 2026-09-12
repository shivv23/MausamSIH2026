import { useEffect, useState } from 'react';
import { Home, CalendarDays, MessageCircle, Bell, User, Wifi, Signal, BatteryMedium } from 'lucide-react';
import type { Card, Homepage, Lang, PersonaKey, UserProfile } from '../lib/engine';
import { t } from '../lib/i18n';
import { HomeScreen } from './screens/Home';
import { MyDayScreen, AskScreen, AlertsScreen, ProfileScreen } from './screens/Secondary';
import { Onboarding } from './screens/Onboarding';
import { ExplainSheet } from './ExplainSheet';

export type Tab = 'home' | 'myday' | 'ask' | 'alerts' | 'me';

interface Props {
  hp: Homepage;
  lang: Lang;
  setLang: (l: Lang) => void;
  offline: boolean;
  onboarding: boolean;
  setOnboarding: (v: boolean) => void;
  onProfile: (u: UserProfile) => void;
  framed: boolean;
  tab: Tab;
  setTab: (t: Tab) => void;
}

export function Phone(props: Props) {
  const { hp, lang, setLang, offline, onboarding, setOnboarding, onProfile, framed, tab, setTab } = props;
  const [explain, setExplain] = useState<Card | null>(null);
  const [filter, setFilter] = useState<PersonaKey | null>(null);
  const [obStep, setObStep] = useState(0);
  const darkStatus = onboarding && obStep === 0;

  useEffect(() => {
    if (onboarding) setObStep(0);
  }, [onboarding]);

  useEffect(() => {
    setExplain(null);
    setFilter(null);
  }, [hp.user.id, hp.scenario.key, hp.city.key]);

  const tabs: { key: Tab; icon: typeof Home; label: string }[] = [
    { key: 'home', icon: Home, label: t(lang, 'nav_home') },
    { key: 'myday', icon: CalendarDays, label: t(lang, 'nav_myday') },
    { key: 'ask', icon: MessageCircle, label: t(lang, 'nav_ask') },
    { key: 'alerts', icon: Bell, label: t(lang, 'nav_alerts') },
    { key: 'me', icon: User, label: t(lang, 'nav_me') },
  ];

  const clock = `${String(hp.hour).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

  const screen = (
    <div className={`relative flex h-full w-full flex-col overflow-hidden bg-[#F8FAFE] ${framed ? 'rounded-[44px]' : ''}`} style={{ fontFamily: lang === 'hi' ? '"Noto Sans Devanagari","Plus Jakarta Sans",system-ui,sans-serif' : undefined }}>
      {/* status bar */}
      <div className={`z-30 flex shrink-0 items-center justify-between px-6 pb-1 text-[12px] font-bold ${framed ? 'pt-3.5' : 'pt-2'} ${darkStatus ? 'absolute inset-x-0 top-0 text-white' : 'text-slate-900'}`}>
        <span>{clock}</span>
        <div className="flex items-center gap-1.5">
          <Signal size={13} />
          {offline ? <span className="text-[9px] font-extrabold uppercase text-amber-500">offline</span> : <Wifi size={13} />}
          <BatteryMedium size={16} />
        </div>
      </div>

      {onboarding ? (
        <div className="min-h-0 flex-1">
          <Onboarding
            lang={lang}
            setLang={setLang}
            onStepChange={setObStep}
            onComplete={(u) => {
              onProfile(u);
              setOnboarding(false);
              setTab('home');
            }}
          />
        </div>
      ) : (
        <>
          <div key={tab} className={`screen-enter min-h-0 flex-1 ${tab === 'ask' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {tab === 'home' && <HomeScreen hp={hp} lang={lang} offline={offline} onExplain={setExplain} onOpenMyDay={() => setTab('myday')} onOpenAlerts={() => setTab('alerts')} filter={filter} setFilter={setFilter} />}
            {tab === 'myday' && <MyDayScreen hp={hp} lang={lang} />}
            {tab === 'ask' && <AskScreen key={`${hp.user.id}-${hp.scenario.key}-${lang}`} hp={hp} lang={lang} />}
            {tab === 'alerts' && <AlertsScreen hp={hp} lang={lang} onExplain={setExplain} />}
            {tab === 'me' && <ProfileScreen hp={hp} lang={lang} setLang={setLang} onRedoOnboarding={() => setOnboarding(true)} />}
          </div>

          {/* tab bar */}
          <nav className={`z-30 shrink-0 border-t border-slate-900/[.06] bg-white/90 px-2 backdrop-blur-xl ${framed ? 'pb-5 pt-1.5' : 'pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5'}`}>
            <ul className="grid grid-cols-5">
              {tabs.map(({ key, icon: I, label }) => {
                const active = tab === key;
                return (
                  <li key={key}>
                    <button onClick={() => setTab(key)} className="flex w-full flex-col items-center gap-0.5 py-1 transition active:scale-95">
                      <span className={`grid h-8 w-12 place-items-center rounded-full transition ${active ? 'bg-[#1565C0]/10 text-[#1565C0]' : 'text-slate-400'}`}>
                        <I size={20} strokeWidth={active ? 2.4 : 2} />
                      </span>
                      <span className={`text-[10px] font-bold ${active ? 'text-[#1565C0]' : 'text-slate-400'}`}>{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}

      {explain && <ExplainSheet card={explain} lang={lang} onClose={() => setExplain(null)} />}
      {framed && <div className="pointer-events-none absolute inset-x-0 bottom-1.5 z-40 mx-auto h-1 w-28 rounded-full bg-slate-900/80" />}
    </div>
  );

  if (!framed) return <div className="h-full w-full">{screen}</div>;

  return (
    <div className="relative h-[820px] w-[390px] shrink-0 rounded-[56px] bg-[#0b0f1a] p-[10px] shadow-[0_40px_80px_-30px_rgba(0,0,0,.7),0_0_0_1px_rgba(255,255,255,.08),inset_0_0_0_2px_rgba(255,255,255,.06)]">
      {/* buttons */}
      <div className="absolute -left-[3px] top-[130px] h-8 w-[3px] rounded-l bg-slate-700" />
      <div className="absolute -left-[3px] top-[180px] h-14 w-[3px] rounded-l bg-slate-700" />
      <div className="absolute -left-[3px] top-[245px] h-14 w-[3px] rounded-l bg-slate-700" />
      <div className="absolute -right-[3px] top-[200px] h-20 w-[3px] rounded-r bg-slate-700" />
      {/* dynamic island */}
      <div className="pointer-events-none absolute left-1/2 top-[22px] z-50 h-[30px] w-[110px] -translate-x-1/2 rounded-full bg-black" />
      <div className="h-full w-full overflow-hidden rounded-[46px]">{screen}</div>
    </div>
  );
}
