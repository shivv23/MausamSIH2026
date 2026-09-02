import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HomepageResponse, UserProfile } from '../types';

// The FastAPI backend base URL. On an Android emulator use 10.0.2.2 to reach
// the host machine's localhost. On a physical device set this to your LAN IP.
export const API_BASE_URL = 'http://10.0.2.2:8000';

const PROFILE_KEY = '@mausam/profile';
const CACHE_KEY = '@mausam/homepage_cache';

export async function loadProfile(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  // Wipe stale cache whenever the profile (personas/city) changes.
  await AsyncStorage.removeItem(CACHE_KEY);
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
  await AsyncStorage.removeItem(CACHE_KEY);
}

async function cacheHomepage(res: HomepageResponse): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), res }));
  } catch {
    // cache is best-effort
  }
}

export async function loadCachedHomepage(): Promise<{ ts: number; res: HomepageResponse } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as { ts: number; res: HomepageResponse }) : null;
  } catch {
    return null;
  }
}

export interface FetchResult {
  ok: boolean;
  data?: HomepageResponse;
  offline: boolean;
  message?: string;
}

export async function fetchHomepage(profile: UserProfile): Promise<FetchResult> {
  const qs = new URLSearchParams({ user_id: profile.user_id, city: profile.city || 'pune' });
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch(`${API_BASE_URL}/api/v1/homepage/cards?${qs}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!resp.ok) {
      const cached = await loadCachedHomepage();
      return cached
        ? { ok: true, data: cached.res, offline: true, message: 'Showing cached data (server error)' }
        : { ok: false, offline: false, message: `Server error ${resp.status}` };
    }
    const data = (await resp.json()) as HomepageResponse;
    await cacheHomepage(data);
    return { ok: true, data, offline: false };
  } catch {
    // Network unreachable -> serve cache (offline-first).
    const cached = await loadCachedHomepage();
    if (cached) {
      return { ok: true, data: cached.res, offline: true, message: 'Offline (cached data)' };
    }
    return { ok: false, offline: true, message: 'Cannot reach Mausam backend. Start it with: uvicorn app.main:app' };
  }
}