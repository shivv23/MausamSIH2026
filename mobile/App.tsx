import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AppState, Platform } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import type { Activity, Card, Lang, LiveWeather, ScenarioKey, UserProfile, Provider } from './src/engine';
import { buildHomepage, CITIES, DEMO_USERS, applyBehaviorSignal } from './src/engine';
import { t } from './src/i18n';
import { fetchLiveWeather, staleLiveWeather } from './src/live';
import type { DisasterAlertWithPolygon } from './src/types';
import Onboarding from './src/screens/Onboarding';
import AuthGate from './src/screens/AuthGate';
import AdminDashboard from './src/screens/AdminDashboard';
import NotificationSettingsModal from './src/screens/NotificationSettings';
import AR from './src/screens/AR';
import Social from './src/screens/Social';
import { ExplainSheet } from './src/components/ExplainSheet';
import MainTabs from './src/navigation/MainTabs';
import { ScreenDepsContext } from './src/navigation/MainTabs';
import type { AppScreenDeps } from './src/navigation/MainTabs';
import { APP_LINKING, TAB_ROUTE } from './src/navigation/types';
import type { RootStackParamList, TabKey } from './src/navigation/types';
import { ToastHost, showToast } from './src/components/Toast';
import { registerForPushNotificationsAsync } from './src/services/notifications';
import {
  saveHomepageToOfflineCache,
  loadHomepageFromOfflineCache,
  calculateStalenessInfo,
  getCacheMetadata,
  setOfflineModeSimulated,
  clearOfflineCache,
} from './src/services/offlineCache';
import { registerBackgroundSync, unregisterBackgroundSync } from './src/services/backgroundSync';
import { checkForUpdates } from './src/services/updates';
import { getAuthToken, getSyncServer, pullProfile, pushProfile, registerPushToken, setAuthToken, subscribeSessionExpired } from './src/services/profileSync';
import { kvGetJson, kvRemove, kvSetJson } from './src/services/db';

const navRef = createNavigationContainerRef<RootStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function gotoTab(tab: TabKey) {
  if (navRef.isReady()) {
    navRef.navigate('Main', { screen: TAB_ROUTE[tab] });
  }
}

const PROFILE_KEY = '@mausam/profile';
const LANG_KEY = '@mausam/lang';
const LIVE_KEY = '@mausam/live';
const LIVE_TTL_MS = 30 * 60 * 1000; // re-fetch every 30 min

SplashScreen.preventAutoHideAsync().catch(() => undefined);

type Demo = (typeof DEMO_USERS)[number];

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [demo, setDemo] = useState<Demo | null>(null);
  const [lang, setLangState] = useState<Lang>('en');
  const [scenario, setScenario] = useState<ScenarioKey | 'auto'>('auto');
  const [hydrated, setHydrated] = useState(false);
  // auth gate: which account id this device is signed in as ('' when logged out)
  const [authedAccountId, setAuthedAccountId] = useState<string | null>(null);
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [skipAuth, setSkipAuth] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
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
  const [networkUp, setNetworkUp] = useState(true);
  const [lastSyncIso, setLastSyncIso] = useState<string>(new Date().toISOString());
  const [providersState, setProvidersState] = useState<Provider[]>([
    { name: 'IMD', status: 'ok', latencyMs: 142 },
    { name: 'CPCB', status: 'ok', latencyMs: 188 },
    { name: 'INCOIS', status: 'ok', latencyMs: 215 },
    { name: 'ISRO', status: 'ok', latencyMs: 310 },
  ]);

  const setLang = (l: Lang) => {
    setLangState(l);
    kvSetJson(LANG_KEY, l);
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
      kvSetJson(LIVE_KEY, { [cityKey]: fresh });
    } catch {
      setLiveError(true);
      showToast(t(lang, 'live_error'), 'error');
      // fall back to last-known live for this city, marked stale
      let cached = liveRef.current[cityKey];
      if (!cached) {
        try {
          const m = await kvGetJson<Record<string, LiveWeather>>(LIVE_KEY);
          if (m) { cached = m[cityKey] ?? (m as unknown as LiveWeather); }
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
        const m = await kvGetJson<Record<string, LiveWeather>>(LIVE_KEY);
        if (m && typeof m === 'object') liveRef.current = m;
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // 1. Register push notification permissions & channels (fire-and-forget;
        //    never blocks first paint, and no-ops on web where push is unsupported)
        void registerForPushNotificationsAsync();

        // 2. Load stored profile & lang from the local SQLite data layer
        const [storedProfile, rawLang, meta] = await Promise.all([
          kvGetJson<UserProfile>(PROFILE_KEY),
          kvGetJson<Lang>(LANG_KEY),
          getCacheMetadata(),
        ]);

        if (rawLang === 'hi' || rawLang === 'en') setLangState(rawLang);
        if (meta) {
          setIsOffline(meta.offlineModeSimulated);
          setLastSyncIso(meta.lastSyncIso);
        }

        if (storedProfile) {
          if (Array.isArray(storedProfile.personas) && storedProfile.personas.length && (storedProfile.id || storedProfile.name)) {
            setProfile(storedProfile);
          } else {
            await kvRemove(PROFILE_KEY);
          }
        } else {
          // Check if cached homepage exists in the local SQLite snapshot store
          const cached = await loadHomepageFromOfflineCache();
          if (cached?.hp?.user) {
            setProfile(cached.hp.user);
            setLastSyncIso(cached.timestamp);
          }
        }

        // 3. Restore the signed-in account for this profile's id (if any token exists)
        if (storedProfile) {
          const token = await getAuthToken(storedProfile.id);
          if (token) setAuthedAccountId(storedProfile.id);
        }
      } catch {
        // ignore corrupt storage
      }
      setHydrated(true);
      SplashScreen.hideAsync().catch(() => undefined);
    })();
  }, []);

  // Keep the offline snapshot fresh while the app is backgrounded. Registered
  // once a signed-in profile exists; dropped on sign-out/redo so no background
  // task runs for a user whose data has been wiped.
  useEffect(() => {
    if (!profile || !authedAccountId) {
      void unregisterBackgroundSync();
      return;
    }
    void registerBackgroundSync();
  }, [profile, authedAccountId]);

  // Any protected call returning 401 (revoked/expired session, password
  // reset elsewhere) wipes the stored token and bounces to the auth gate.
  useEffect(() => {
    const unsub = subscribeSessionExpired(() => {
      setAuthedAccountId(null);
      setSessionNotice(t(lang, 'sec_pull_401'));
    });
    return unsub;
  }, [lang]);

  // Register this device for server-push once signed in (fire-and-forget).
  useEffect(() => {
    if (!authedAccountId) return;
    let cancelled = false;
    (async () => {
      try {
        const [token, server] = await Promise.all([getAuthToken(authedAccountId), getSyncServer()]);
        if (cancelled || !token || !server) return;
        await registerForPushNotificationsAsync();
        const push = await Notifications.getExpoPushTokenAsync();
        if (cancelled || !push?.data) return;
        await registerPushToken(
          server,
          authedAccountId,
          token,
          push.data,
          Platform.OS === 'ios' ? 'ios' : 'android',
        );
      } catch {
        // offline, missing projectId, or permission denied → skip silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedAccountId]);

  // Connectivity: detect real network loss so stale caches are marked explicitly.
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected = state.isConnected !== false;
      setNetworkUp(connected);
      if (connected) {
        // came back online → refresh live data for the active city
        if (profile) refreshLive(profile.city || 'pune');
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // App foregrounding: refresh live data + provider status when returning.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && profile) refreshLive(profile.city || 'pune');
      // Prefetch OTA updates quietly in built apps; applied on next cold start.
      if (next === 'active') void checkForUpdates(true);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Tapping a push notification (or app opened from a cold-start push) routes
  // to the alert centre so the message is never lost.
  useEffect(() => {
    if (!authedAccountId) return;
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      gotoTab('alerts');
    });
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp) gotoTab('alerts');
    });
    return () => sub.remove();
  }, [authedAccountId]);

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
    gotoTab('home');
    kvSetJson(PROFILE_KEY, d.user);
  };

  const handleOnboardingDone = async (p: UserProfile, cityKey: string) => {
    setDemo(null);
    setProfile(p);
    setLang(p.language);
    gotoTab('home');
    setScenario('auto');
    await kvSetJson(PROFILE_KEY, p);
    // If the user just authenticated, back this new profile up under the
    // account id so it exists on the server from day one.
    if (pendingAccountId) {
      try {
        const token = await getAuthToken(pendingAccountId);
        const server = await getSyncServer();
        if (token && server) await pushProfile(p, server, token);
      } catch {
        // offline / server down: skip auto-backup, user can Push manually
      } finally {
        setPendingAccountId(null);
      }
    }
  };

  /** Called by the AuthGate after a successful sign-in/create. */
  const handleAuthed = async (restored: UserProfile | null, accountId: string) => {
    setSkipAuth(false);
    setSessionNotice(null);
    setAuthedAccountId(accountId);
    if (restored) {
      // signed in and the account has a cloud backup → go straight to Home
      await clearOfflineCache();
      setActiveAlert(null);
      setProfile(restored);
      setLang(restored.language);
      setDemo(null);
      setScenario('auto');
      gotoTab('home');
      await kvSetJson(PROFILE_KEY, restored);
    } else {
      // account exists (or was created) but has no backup → build one via onboarding
      setPendingAccountId(accountId);
    }
  };

  /** Sign-out triggers the auth gate again on next render. */
  const handleSessionEnded = () => {
    setAuthedAccountId(null);
    setSkipAuth(false);
    gotoTab('home');
  };

  /** Apply a profile pulled from the cloud (cross-device sync). */
  const applySyncedProfile = async (p: UserProfile) => {
    setProfile(p);
    setLang(p.language);
    setDemo(null);
    setScenario('auto');
    gotoTab('home');
    await kvSetJson(PROFILE_KEY, p);
  };

  // Cross-device restore: the whole device session switches to another account.
  // Wipe the previous user's offline cache (health/location data) before
  // adopting the restored profile, and drop any admin-issued active alert.
  const restoreAccountProfile = async (p: UserProfile) => {
    await clearOfflineCache();
    setActiveAlert(null);
    setProfile(p);
    setLang(p.language);
    setDemo(null);
    setScenario('auto');
    gotoTab('home');
    await kvSetJson(PROFILE_KEY, p);
  };

  const redoOnboarding = async () => {
    if (demo) {
      switchDemo(demo);
      return;
    }
    // Full session wipe: profile, this user's cloud token, and the offline
    // cache (which embeds the previous user's health/location data).
    const userId = profile?.id;
    if (userId) await setAuthToken(userId, null);
    await clearOfflineCache();
    setAuthedAccountId(null);
    setPendingAccountId(null);
    setProfile(null);
    gotoTab('home');
    await kvRemove(PROFILE_KEY);
  };

  const setScenarioOverride = (s: ScenarioKey | 'auto') => {
    setScenario(s);
    gotoTab('home');
  };

  const addActivity = (a: Activity) => {
    setProfile((p) => (p ? { ...p, activities: [...p.activities, { ...a, time: a.time || '09:00' }] } : p));
  };

  const handleCardSignal = (type: Card['type'], signal: 'tap' | 'dismiss') => {
    setProfile((p) => {
      if (!p) return p;
      const next = { ...p, behaviorBias: applyBehaviorSignal(type, signal, p.behaviorBias) };
      kvSetJson(PROFILE_KEY, next);
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
    showToast(t(lang, 'live_synced'), 'success');
  };

  if (!hydrated) {
    return <SafeAreaProvider>{null}</SafeAreaProvider>;
  }

  // Not signed in → ask for sign up / sign in before anything else.
  if (!authedAccountId && !skipAuth) {
    return (
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <AuthGate
          lang={lang}
          defaultAccountId={profile?.id}
          notice={sessionNotice ?? undefined}
          onAuthed={handleAuthed}
          onSkip={() => setSkipAuth(true)}
        />
      </SafeAreaProvider>
    );
  }

  if (!profile) {
    return (
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Onboarding
          lang={lang}
          onDone={handleOnboardingDone}
          fixedId={authedAccountId ?? undefined}
        />
      </SafeAreaProvider>
    );
  }

  const hp = buildHomepage({ user: profile, cityKey: profile.city || 'pune', scenarioKey: scenario, hour: new Date().getHours(), lang, live: scenario === 'auto' ? live : null });

  // Inject dynamic chaos provider states
  hp.providers = providersState;

  // Persist to local offline database asynchronously
  saveHomepageToOfflineCache(hp);

  const staleness = calculateStalenessInfo(lastSyncIso, isOffline || scenario !== 'auto');

  const deps: AppScreenDeps = {
    hp,
    lang,
    scenario,
    setLang,
    activeAlert,
    staleness,
    liveFresh: !!(live && liveForCity === activeCityKey && !live.stale),
    liveStale: !!((live && liveForCity === activeCityKey && live.stale) || liveError),
    liveBusy,
    offline: scenario !== 'auto' || isOffline || !networkUp,
    isOffline,
    onSelectCity: (cityKey) => setProfile((p) => (p ? { ...p, city: cityKey } : p)),
    onAddActivity: addActivity,
    onCardSignal: handleCardSignal,
    onExplain: setExplaining,
    onRedoOnboarding: redoOnboarding,
    onSwitchDemo: switchDemo,
    onSetScenario: setScenarioOverride,
    onOpenAdmin: () => setShowAdmin(true),
    onOpenNotifSettings: () => setShowNotifSettings(true),
    onOpenAR: () => setShowAR(true),
    onOpenSocial: () => setShowSocial(true),
    onRetry: () => {
      handleSyncNow();
      refreshLive(activeCityKey, true);
    },
    onSyncPull: applySyncedProfile,
    onRestoreAccount: restoreAccountProfile,
    onSessionEnded: handleSessionEnded,
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <ScreenDepsContext.Provider value={deps}>
        <NavigationContainer
          ref={navRef}
          linking={APP_LINKING as unknown as LinkingOptions<RootStackParamList>}
        >
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            <RootStack.Screen name="Main" component={MainTabs} />
          </RootStack.Navigator>
        </NavigationContainer>
      </ScreenDepsContext.Provider>

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
      <ToastHost />
    </SafeAreaProvider>
  );
}
