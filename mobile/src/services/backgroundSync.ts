import { Platform } from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import type { UserProfile } from '../engine';
import { CITIES, buildHomepage } from '../engine';
import { fetchLiveWeather } from '../live';
import { kvGetJson, kvSetJson } from './db';
import { saveHomepageToOfflineCache } from './offlineCache';

const PROFILE_KEY = '@mausam/profile';
const LIVE_KEY = '@mausam/live';

/**
 * Refreshes the offline snapshot for the current user while the app is in the
 * background (deferred by the OS; WorkManager on Android, BGTaskScheduler on
 * iOS). Keeps the SQLite cache fresh so the app opens instantly with live data.
 */
export const BACKGROUND_SYNC_TASK = 'mausam-background-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const profile = await kvGetJson<UserProfile>(PROFILE_KEY);
    if (!profile) return BackgroundTask.BackgroundTaskResult.Failed;
    const cityKey = profile.city || 'pune';
    const city = CITIES.find((c) => c.key === cityKey);
    if (!city) return BackgroundTask.BackgroundTaskResult.Success;

    const live = await fetchLiveWeather(city.lat, city.lon, new Date());
    const hp = buildHomepage({
      user: profile,
      cityKey,
      scenarioKey: 'auto',
      hour: new Date().getHours(),
      lang: profile.language,
      live,
    });
    await saveHomepageToOfflineCache(hp);
    const cache: Record<string, unknown> = {};
    try {
      const m = await kvGetJson<Record<string, unknown>>(LIVE_KEY);
      if (m && typeof m === 'object') Object.assign(cache, m);
    } catch { /* ignore */ }
    cache[cityKey] = live;
    await kvSetJson(LIVE_KEY, cache);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Schedule the background sync task. Safe to call multiple times; on web the
 * task simply never fires (status Restricted). Opts out of the capability for
 * users who never completed a profile.
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) return true;
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 60, // advisory; OS decides the exact window
    });
    return true;
  } catch {
    return false;
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    }
  } catch {
    /* ignore */
  }
}