import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Activity, Card, Lang, ScenarioKey, UserProfile, Provider } from './src/engine';
import { buildHomepage, DEMO_USERS } from './src/engine';
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

export type Tab = 'home' | 'map' | 'myday' | 'ask' | 'alerts' | 'me';

const PROFILE_KEY = '@mausam/profile';
const LANG_KEY = '@mausam/lang';

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
  const [showAdmin, setShowAdmin] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);

  // Live disaster alert and offline state (§13.2, §5.5, §8.4)
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

  const switchDemo = (d: Demo) => {
    setDemo(d);
    setProfile(d.user);
    setLang(d.user.language);
    setScenario(d.scenarioKey);
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

  const hp = buildHomepage({
    user: profile,
    cityKey: profile.city || 'pune',
    scenarioKey: scenario,
    hour: new Date().getHours(),
    lang,
  });

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
          offline={isOffline || scenario !== 'auto'}
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
          onRetry={handleSyncNow}
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
