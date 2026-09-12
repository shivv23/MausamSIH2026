import React, { createContext, useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { Activity, Card, Homepage, Lang, ScenarioKey, UserProfile } from '../engine';
import { DEMO_USERS } from '../engine';
import type { DisasterAlertWithPolygon, StalenessInfo } from '../types';
import Home from '../screens/Home';
import MapScreen from '../screens/MapScreen';
import MyDay from '../screens/MyDay';
import Ask from '../screens/Ask';
import Alerts from '../screens/Alerts';
import Me from '../screens/Me';
import TabBar from '../components/TabBar';
import type { MainTabsParamList, TabKey } from './types';
import { ROUTE_TO_TAB, TAB_ROUTE } from './types';

const Tab = createBottomTabNavigator<MainTabsParamList>();

/** Everything the tab screens need from App, minus pure navigation callbacks. */
export interface AppScreenDeps {
  hp: Homepage;
  lang: Lang;
  scenario: ScenarioKey | 'auto';
  setLang: (l: Lang) => void;
  activeAlert: DisasterAlertWithPolygon | null;
  staleness: StalenessInfo;
  liveFresh: boolean;
  liveStale: boolean;
  liveBusy: boolean;
  offline: boolean;
  isOffline: boolean;
  onSelectCity: (cityKey: string) => void;
  onAddActivity: (a: Activity) => void;
  onCardSignal: (type: Card['type'], signal: 'tap' | 'dismiss') => void;
  onExplain: (c: Card) => void;
  onRedoOnboarding: () => void;
  onSwitchDemo: (demo: (typeof DEMO_USERS)[number]) => void;
  onSetScenario: (s: ScenarioKey | 'auto') => void;
  onOpenAdmin: () => void;
  onOpenNotifSettings: () => void;
  onOpenAR: () => void;
  onOpenSocial: () => void;
  onRetry: () => void;
  onSyncPull: (p: UserProfile) => void;
  onRestoreAccount: (p: UserProfile) => void;
  onSessionEnded: () => void;
}

/** Provided by App once; consumed by every tab screen below. */
export const ScreenDepsContext = createContext<AppScreenDeps | null>(null);
export function useScreenDeps(): AppScreenDeps {
  const deps = useContext(ScreenDepsContext);
  if (!deps) throw new Error('MainTabs must be rendered under ScreenDepsContext');
  return deps;
}

type TabNav = BottomTabNavigationProp<MainTabsParamList>;

function HomeTab() {
  const deps = useScreenDeps();
  const navigation = useNavigation<TabNav>();
  return (
    <Home
      hp={deps.hp}
      lang={deps.lang}
      offline={deps.offline}
      liveFresh={deps.liveFresh}
      liveStale={deps.liveStale}
      liveBusy={deps.liveBusy}
      activeAlert={deps.activeAlert}
      staleness={deps.staleness}
      onOpenMyDay={() => navigation.navigate('MyDay')}
      onOpenAlerts={() => navigation.navigate('Alerts')}
      onOpenMe={() => navigation.navigate('Me')}
      onOpenMap={() => navigation.navigate('Map')}
      onOpenAdmin={deps.onOpenAdmin}
      onOpenNotifSettings={deps.onOpenNotifSettings}
      onOpenAR={deps.onOpenAR}
      onOpenSocial={deps.onOpenSocial}
      onRedoOnboarding={deps.onRedoOnboarding}
      onRetry={deps.onRetry}
      onCardSignal={deps.onCardSignal}
    />
  );
}

function MapTab() {
  const deps = useScreenDeps();
  return (
    <MapScreen
      hp={deps.hp}
      lang={deps.lang}
      activeAlert={deps.activeAlert}
      onOpenAdmin={deps.onOpenAdmin}
      onSelectCity={deps.onSelectCity}
    />
  );
}

function MyDayTab() {
  const deps = useScreenDeps();
  return <MyDay hp={deps.hp} lang={deps.lang} onAddActivity={deps.onAddActivity} />;
}

function AskTab() {
  const deps = useScreenDeps();
  return <Ask hp={deps.hp} lang={deps.lang} />;
}

function AlertsTab() {
  const deps = useScreenDeps();
  const navigation = useNavigation<TabNav>();
  return (
    <Alerts
      hp={deps.hp}
      lang={deps.lang}
      activeAlert={deps.activeAlert}
      onExplain={deps.onExplain}
      onOpenMap={() => navigation.navigate('Map')}
      onOpenNotifSettings={deps.onOpenNotifSettings}
    />
  );
}

function MeTab() {
  const deps = useScreenDeps();
  return (
    <Me
      hp={deps.hp}
      lang={deps.lang}
      scenario={deps.scenario}
      setLang={deps.setLang}
      onRedoOnboarding={deps.onRedoOnboarding}
      onSwitchDemo={deps.onSwitchDemo}
      onSetScenario={deps.onSetScenario}
      onOpenAdmin={deps.onOpenAdmin}
      onOpenNotifSettings={deps.onOpenNotifSettings}
      onSyncPull={deps.onSyncPull}
      onRestoreAccount={deps.onRestoreAccount}
      onSessionEnded={deps.onSessionEnded}
      isOffline={deps.isOffline}
      staleness={deps.staleness}
    />
  );
}

/**
 * The signed-in main area: a bottom-tab navigator with a custom TabBar.
 * Rendered as the single "Main" screen of App's root native stack so the
 * app keeps a real back-stack and nested deep links (mausam://alerts → tab).
 */
export default function MainTabs() {
  const deps = useScreenDeps();
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => {
        const route = props.state.routes[props.state.index].name;
        return (
          <TabBar
            current={ROUTE_TO_TAB[route]}
            lang={deps.lang}
            onTab={(tab: TabKey) => props.navigation.navigate(TAB_ROUTE[tab])}
          />
        );
      }}
    >
      <Tab.Screen name="Home" component={HomeTab} />
      <Tab.Screen name="Map" component={MapTab} />
      <Tab.Screen name="MyDay" component={MyDayTab} />
      <Tab.Screen name="Ask" component={AskTab} />
      <Tab.Screen name="Alerts" component={AlertsTab} />
      <Tab.Screen name="Me" component={MeTab} />
    </Tab.Navigator>
  );
}