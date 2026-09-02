import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Activity, Card, Lang, LiveWeather, ScenarioKey, UserProfile } from './src/engine';
import { buildHomepage, CITIES, DEMO_USERS } from './src/engine';
import { fetchLiveWeather, staleLiveWeather } from './src/live';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';
import MyDay from './src/screens/MyDay';
import Ask from './src/screens/Ask';
import Alerts from './src/screens/Alerts';
import Me from './src/screens/Me';
import AR from './src/screens/AR';
import Social from './src/screens/Social';
import TabBar from './src/components/TabBar';
import { ExplainSheet } from './src/components/ExplainSheet';

export type Tab = 'home' | 'myday' | 'ask' | 'alerts' | 'me';

const PROFILE_KEY = '@mausam/profile';
const LANG_KEY = '@mausam/lang';
const LIVE_KEY = '@mausam/live';
const LIVE_TTL_MS = 30 * 60 * 1000; // re-fetch every 30 min

const POPULAR_ACTIVITIES: Activity[] = [
  { type: 'walk', label: 'Evening walk', labelHi: 'शाम की सैर', time: '18:00' },
  { type: 'yoga', label: 'Morning yoga', labelHi: 'सुबह का योग', time: '06:30' },
  { type: 'run', label: 'Easy run', labelHi: 'आसान दौड़', time: '07:00' },
  { type: 'cycle', label: 'Cycle ride', labelHi: 'साइकिल की सवारी', time: '17:30' },
  { type: 'swim', label: 'Swim class', labelHi: 'तैराकी कक्षा', time: '16:00' },
  { type: 'event', label: 'Outdoor event', labelHi: 'मैदानी कार्यक्रम', time: '19:00' },
  { type: 'travel', label: 'Travel / trip', labelHi: 'यात्रा', time: '10:30' },
];

type Demo = (typeof DEMO_USERS)[number];

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [demo, setDemo] = useState<Demo | null>(null);
  const [lang, setLangState] = useState<Lang>('en');
  const [scenario, setScenario] = useState<ScenarioKey | 'auto'>('auto');
  const [tab, setTab] = useState<Tab>('home');
  const [hydrated, setHydrated] = useState(false);
  const [explaining, setExplaining] = useState<Card | null>(null);
  const [showAR, setShowAR] = useState(false);
  const [showSocial, setShowSocial] = useState(false);
  const [live, setLive] = useState<LiveWeather | null>(null);
  const [liveForCity, setLiveForCity] = useState<string | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const liveRef = useRef<Record<string, LiveWeather>>({});

  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l);
  };

  const refreshLive = async (cityKey: string, force = false) => {
    const city = CITIES.find((c) => c.key === cityKey);
    if (!city) return;
    setLiveBusy(true);
    setLiveError(false);
    try {
      const fresh = await fetchLiveWeather(city.lat, city.lon, new Date());
      liveRef.current[cityKey] = fresh;
      setLive(fresh);
      setLiveForCity(cityKey);
      AsyncStorage.setItem(LIVE_KEY, JSON.stringify({ [cityKey]: fresh }));
    } catch {
      setLiveError(true);
      // fall back to last-known live for this city, marked stale
      let cached = liveRef.current[cityKey];
      if (!cached) {
        try {
          const s = await AsyncStorage.getItem(LIVE_KEY);
          if (s) { const m = JSON.parse(s); cached = m[cityKey] ?? m; }
        } catch { /* ignore */ }
      }
      if (cached) { const st = staleLiveWeather(cached); setLive(st); setLiveForCity(cityKey); liveRef.current[cityKey] = st; }
    } finally {
      setLiveBusy(false);
    }
  };

  // hydrate last-known live cache
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LIVE_KEY);
        if (raw) {
          const m = JSON.parse(raw);
          if (m && typeof m === 'object') liveRef.current = m;
        }
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [rawProfile, rawLang] = await Promise.all([AsyncStorage.getItem(PROFILE_KEY), AsyncStorage.getItem(LANG_KEY)]);
        if (rawLang === 'hi' || rawLang === 'en') setLangState(rawLang);
        if (rawProfile) {
          const parsed = JSON.parse(rawProfile);
          // Discard legacy / malformed shapes (old backend profile had no id/name/personas-as-keys).
          if (parsed && Array.isArray(parsed.personas) && parsed.personas.length && (parsed.id || parsed.name)) {
            setProfile(parsed);
          } else {
            await AsyncStorage.removeItem(PROFILE_KEY);
          }
        }
      } catch {
        // ignore corrupt storage
      }
      setHydrated(true);
    })();
  }, []);

  // fetch live weather whenever the active city changes
  const activeCityKey = profile?.city || 'pune';
  useEffect(() => {
    if (!hydrated || !profile) return;
    if (liveForCity === activeCityKey && live) return;
    refreshLive(activeCityKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, activeCityKey, profile]);

  // periodic refresh
  useEffect(() => {
    if (!profile) return;
    const id = setInterval(() => refreshLive(activeCityKey), LIVE_TTL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, activeCityKey]);

  const switchDemo = (d: Demo) => {
    setDemo(d);
    setProfile(d.user);
    setLang(d.user.language);
    // live real data drives the demo user's city; manual scenario is available via the drill.
    setScenario('auto');
    setTab('home');
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(d.user));
  };

  const handleOnboardingDone = (p: UserProfile, cityKey: string) => {
    setDemo(null);
    setProfile(p);
    setLang(p.language);
    setTab('home');
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    // a hand-built profile always uses that city's default scenario
    setScenario('auto');
  };

  const redoOnboarding = () => {
    if (demo) { switchDemo(demo); return; }
    setProfile(null);
    setTab('home');
    AsyncStorage.removeItem(PROFILE_KEY);
  };

  const setScenarioOverride = (s: ScenarioKey | 'auto') => {
    setScenario(s);
    setTab('home');
  };

  const addActivity = (a: Activity) => {
    setProfile((p) => (p ? { ...p, activities: [...p.activities, { ...a, time: a.time || '09:00' }] } : p));
  };

  if (!hydrated) {
    return <SafeAreaProvider>{null}</SafeAreaProvider>;
  }

  if (!profile) {
    return (
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Onboarding lang={lang} onDone={handleOnboardingDone} />
      </SafeAreaProvider>
    );
  }

  const hp = buildHomepage({ user: profile, cityKey: profile.city || 'pune', scenarioKey: scenario, hour: new Date().getHours(), lang, live: scenario === 'auto' ? live : null });

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {tab === 'home' && (
        <Home hp={hp} lang={lang} offline={scenario !== 'auto'}
          liveFresh={!!(live && liveForCity === activeCityKey && !live.stale)}
          liveStale={!!((live && liveForCity === activeCityKey && live.stale) || liveError)}
          liveBusy={liveBusy}
          onOpenMyDay={() => setTab('myday')} onOpenAlerts={() => setTab('alerts')} onOpenMe={() => setTab('me')}
          onOpenAR={() => setShowAR(true)} onOpenSocial={() => setShowSocial(true)}
          onRedoOnboarding={redoOnboarding} onRetry={() => refreshLive(activeCityKey, true)} />
      )}
      {tab === 'myday' && <MyDay hp={hp} lang={lang} onAddActivity={addActivity} />}
      {tab === 'ask' && <Ask hp={hp} lang={lang} />}
      {tab === 'alerts' && <Alerts hp={hp} lang={lang} onExplain={setExplaining} />}
      {tab === 'me' && <Me hp={hp} lang={lang} scenario={scenario} setLang={setLang} onRedoOnboarding={redoOnboarding} onSwitchDemo={switchDemo} onSetScenario={setScenarioOverride} />}
      <TabBar current={tab} onTab={setTab} lang={lang} />
      <ExplainSheet card={explaining} lang={lang} onClose={() => setExplaining(null)} />
      {showAR && <AR hp={hp} lang={lang} onClose={() => setShowAR(false)} />}
      {showSocial && <Social hp={hp} lang={lang} onClose={() => setShowSocial(false)} />}
    </SafeAreaProvider>
  );
}