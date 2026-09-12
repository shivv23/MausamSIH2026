import type { NavigatorScreenParams } from '@react-navigation/native';

/** Tab route keys used across the app (also the old `tab ===` union). */
export type TabKey = 'home' | 'map' | 'myday' | 'ask' | 'alerts' | 'me';

export type MainTabsParamList = {
  Home: undefined;
  Map: undefined;
  MyDay: undefined;
  Ask: undefined;
  Alerts: undefined;
  Me: undefined;
};

/** Root native-stack: hosts the tab navigator, future detail/pushed screens. */
export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabsParamList> | undefined;
};

export const TAB_ROUTE: Record<TabKey, keyof MainTabsParamList> = {
  home: 'Home',
  map: 'Map',
  myday: 'MyDay',
  ask: 'Ask',
  alerts: 'Alerts',
  me: 'Me',
};

export const ROUTE_TO_TAB: Record<string, TabKey> = {
  Home: 'home',
  Map: 'map',
  MyDay: 'myday',
  Ask: 'ask',
  Alerts: 'alerts',
  Me: 'me',
};

/** Deep-link routing: mausam://alerts → Alerts tab, mausam://home → Home, … */
export const APP_LINKING = {
  prefixes: ['mausam://', 'https://mausam.in/app'],
  config: {
    screens: {
      Main: {
        initialRouteName: 'Home',
        screens: {
          Home: 'home',
          Map: 'map',
          MyDay: 'myday',
          Ask: 'ask',
          Alerts: 'alerts',
          Me: 'me',
        },
      },
    },
  },
} as const;