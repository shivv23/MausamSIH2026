import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Activity, Card, Lang, LiveWeather, ScenarioKey, UserProfile, Provider } from './src/engine';
import { buildHomepage, CITIES, DEMO_USERS, applyBehaviorSignal } from './src/engine';
import { fetchLiveWeather, staleLiveWeather } from './src/live';
import type { DisasterAlertWithPolygon } from './src/types';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';
import MapScreen from './src/screens/MapScreen';
import MyDay from './src/screens/MyDay';
import Ask from './src/screens/Ask';
import Alerts from './src/screens/Alerts';
import Me from './src/screens/Me';
import AdminDashboard from './src/screens/AdminDashboard';
import NotificationSettingsModal from './src/screens/NotificationSettings';
import AR from './src/screens/AR';
import Social from './src/screens/Social';
import TabBar from './src/components/TabBar';
import { ExplainSheet } from './src/components/ExplainSheet';
import { registerForPushNotificationsAsync } from './src/services/notifications';
import {
  saveHomepageToOfflineCache,
  loadHomepageFromOfflineCache,
  calculateStalenessInfo,
  getCacheMetadata,
  setOfflineModeSimulated,
} from './src/services/offlineCache';
import { pullProfile } from './src/services/profileSync';

export type Tab = 'home' | 'map' | 'myday' | 'ask' | 'alerts' | 'me';

const PROFILE_KEY = '@mausam/profile';
const LANG_KEY = '@mausam/lang';
const LIVE_KEY = '@mausam/live';
const LIVE_TTL_MS = 30 * 60 * 1000; // re-fetch every 30 min

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
  // Live real-time weather (real-time engine integration)
  const [live, setLive] = useState<LiveWeather | null>(null);
  const [liveForCity, setLiveForCity] = useState<string | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const liveRef = useRef<Record<string, LiveWeather>>({});
  // P1 features: admin console, notifications, live geofenced alerts, offline
  const [showAdmin, setShowAdmin] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [activeAlert, setActiveAlert] = useState<DisasterAlertWithPolygon | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncIso, setLastSyncIso] = useState<string>(new Date().toISOString());
  const [providersState, setProvidersState] = useState<Provider[]>([
    { name: 'IMD', status: 'ok', latencyMs: 142 },
    { name: 'CPCB', status: 'ok', latencyMs: 188 },
    { name: 'INCOIS', status: 'ok', latencyMs: 215 },
    { name: 'ISRO', status: 'ok', latencyMs: 310 },
    { name: 'Open-Meteo', status: 'ok', latencyMs: 95 },
  ]);

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
        // 1. Register push notification permissions & channels
        await registerForPushNotificationsAsync();

        // 2. Load stored profile & lang
        const [rawProfile, rawLang, meta] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(LANG_KEY),
          getCacheMetadata(),
        ]);

        if (rawLang === 'hi' || rawLang === 'en') setLangState(rawLang);
        if (meta) {
          setIsOffline(meta.offlineModeSimulated);
          setLastSyncIso(meta.lastSyncIso);
        }

        if (rawProfile) {
          const parsed = JSON.parse(rawProfile);
          if (parsed && Array.isArray(parsed.personas) && parsed.personas.length && (parsed.id || parsed.name)) {
            setProfile(parsed);
          } else {
            await AsyncStorage.removeItem(PROFILE_KEY);
          }
        } else {
          // Check if cached homepage exists in WatermelonDB offline storage
          const cached = await loadHomepageFromOfflineCache();
          if (cached?.hp?.user) {
            setProfile(cached.hp.user);
            setLastSyncIso(cached.timestamp);
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
    setScenario('auto');
  };

  /** Apply a profile pulled from the cloud (cross-device sync). */
  const applySyncedProfile = async (p: UserProfile) => {
    setProfile(p);
    setLang(p.language);
    setDemo(null);
    setScenario('auto');
    setTab('home');
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  };

  const redoOnboarding = () => {
    if (demo) {
      switchDemo(demo);
      return;
    }
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

  const handleCardSignal = (type: Card['type'], signal: 'tap' | 'dismiss') => {
    setProfile((p) => {
      if (!p) return p;
      const next = { ...p, behaviorBias: applyBehaviorSignal(type, signal, p.behaviorBias) };
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handlePublishAdminAlert = (alert: DisasterAlertWithPolygon) => {
    setActiveAlert(alert);
    // When an IMD Orange/Red alert is triggered, switch scenario to mirror emergency conditions
    if (alert.eventType === 'heavy_rain') {
      setScenario('rainy_commute');
    } else if (alert.eventType === 'cyclone') {
      setScenario('cyclone');
    } else if (alert.eventType === 'heatwave') {
      setScenario('heatwave');
    } else if (alert.eventType === 'frost') {
      setScenario('frost_night');
    } else if (alert.eventType === 'aqi_spike') {
      setScenario('aqi_spike');
    }
  };

  const handleClearAlert = () => {
    setActiveAlert(null);
    setScenario('auto');
  };

  const handleToggleOffline = async (val: boolean) => {
    setIsOffline(val);
    await setOfflineModeSimulated(val);
  };

  const handleSyncNow = async () => {
    const nowIso = new Date().toISOString();
    setLastSyncIso(nowIso);
    setIsOffline(false);
    await setOfflineModeSimulated(false);
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

  // Inject dynamic chaos provider states
  hp.providers = providersState;

  // Persist to local offline database asynchronously
  saveHomepageToOfflineCache(hp);

  const staleness = calculateStalenessInfo(lastSyncIso, isOffline || scenario !== 'auto');

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {tab === 'home' && (
        <Home
          hp={hp}
          lang={lang}
          offline={scenario !== 'auto' || isOffline}
          liveFresh={!!(live && liveForCity === activeCityKey && !live.stale)}
          liveStale={!!((live && liveForCity === activeCityKey && live.stale) || liveError)}
          liveBusy={liveBusy}
          activeAlert={activeAlert}
          staleness={staleness}
          onOpenMyDay={() => setTab('myday')}
          onOpenAlerts={() => setTab('alerts')}
          onOpenMe={() => setTab('me')}
          onOpenMap={() => setTab('map')}
          onOpenAdmin={() => setShowAdmin(true)}
          onOpenNotifSettings={() => setShowNotifSettings(true)}
          onOpenAR={() => setShowAR(true)}
          onOpenSocial={() => setShowSocial(true)}
          onRedoOnboarding={redoOnboarding}
          onRetry={() => { handleSyncNow(); refreshLive(activeCityKey, true); }}
          onCardSignal={handleCardSignal}
        />
      )}

      {tab === 'map' && (
        <MapScreen
          hp={hp}
          lang={lang}
          activeAlert={activeAlert}
          onOpenAdmin={() => setShowAdmin(true)}
          onSelectCity={(cityKey) => {
            setProfile((p) => (p ? { ...p, city: cityKey } : p));
          }}
        />
      )}

      {tab === 'myday' && <MyDay hp={hp} lang={lang} onAddActivity={addActivity} />}
      {tab === 'ask' && <Ask hp={hp} lang={lang} />}
      {tab === 'alerts' && (
        <Alerts
          hp={hp}
          lang={lang}
          activeAlert={activeAlert}
          onExplain={setExplaining}
          onOpenMap={() => setTab('map')}
          onOpenNotifSettings={() => setShowNotifSettings(true)}
        />
      )}
      {tab === 'me' && (
        <Me
          hp={hp}
          lang={lang}
          scenario={scenario}
          setLang={setLang}
          onRedoOnboarding={redoOnboarding}
          onSwitchDemo={switchDemo}
          onSetScenario={setScenarioOverride}
          onOpenAdmin={() => setShowAdmin(true)}
          onOpenNotifSettings={() => setShowNotifSettings(true)}
          onSyncPull={applySyncedProfile}
          isOffline={isOffline}
          staleness={staleness}
        />
      )}

      <TabBar current={tab} onTab={setTab} lang={lang} />

      {/* Modals & Bottom Sheets */}
      <ExplainSheet card={explaining} lang={lang} onClose={() => setExplaining(null)} />

      {showAdmin && (
        <AdminDashboard
          hp={hp}
          lang={lang}
          onClose={() => setShowAdmin(false)}
          onPublishAlert={handlePublishAdminAlert}
          onClearAlert={handleClearAlert}
          onToggleOffline={handleToggleOffline}
          isOffline={isOffline}
          providers={providersState}
          onUpdateProviders={setProvidersState}
        />
      )}

      {showNotifSettings && (
        <NotificationSettingsModal
          lang={lang}
          onClose={() => setShowNotifSettings(false)}
        />
      )}

      {showAR && <AR hp={hp} lang={lang} onClose={() => setShowAR(false)} />}
      {showSocial && <Social hp={hp} lang={lang} onClose={() => setShowSocial(false)} />}
    </SafeAreaProvider>
  );
}
