import { registerRootComponent } from 'expo';
import { createElement } from 'react';
import * as Sentry from '@sentry/react-native';

import App from './App';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Crash reporting: enable only when a DSN is supplied (EXPO_PUBLIC_SENTRY_DSN
// via eas.json/.env). enableNative:false keeps Expo Go / dev builds functional;
// a release build still forwards JS errors + handled exceptions.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enableNative: false,
    tracesSampleRate: 0.2,
    environment: process.env.EXPO_PUBLIC_APP_ENV || process.env.MAUSAM_ENV || 'development',
  });
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately. Wrapping in an ErrorBoundary keeps a
// single render crash from collapsing the app to a silent white screen.
registerRootComponent(() => createElement(ErrorBoundary, null, createElement(App)));