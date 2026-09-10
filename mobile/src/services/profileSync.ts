import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { UserProfile } from '../engine';

const SERVER_KEY = '@mausam/sync_server';
const LEGACY_TOKEN_KEY = '@mausam/sync_token';
const SYNC_TIME_KEY = '@mausam/sync_times';

const tokenKeyFor = (userId: string) => `mausam_sync_token_${userId}`;

export async function getSyncServer(): Promise<string | null> {
  return AsyncStorage.getItem(SERVER_KEY);
}

export async function setSyncServer(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean) {
    await AsyncStorage.removeItem(SERVER_KEY);
    return;
  }
  const validated = validateServerUrl(clean);
  if (!validated) {
    throw new Error('Sync server must use https:// (http:// only for localhost in development)');
  }
  await AsyncStorage.setItem(SERVER_KEY, validated);
}

/**
 * True when a server URL is safe to contact. HTTPS is always allowed; plain
 * HTTP is allowed ONLY for loopback/LAN hosts inside a development build, so
 * the local backend works on the simulator without shipping cleartext to
 * arbitrary endpoints in production.
 */
export function validateServerUrl(raw: string): string | null {
  const u = raw.trim().replace(/\/+$/, '');
  const m = u.match(/^(https?):\/\/([^/:]+)(:\d+)?/i);
  if (!m) return null;
  const [, scheme, host] = m;
  if (scheme.toLowerCase() === 'https') return u;
  if (scheme.toLowerCase() !== 'http') return null;
  const hostL = host.toLowerCase();
  const loopback = hostL === 'localhost' || hostL === '127.0.0.1' || hostL === '[::1]' || hostL === '::1';
  const lanIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (isDev && (loopback || lanIp)) return u;
  if (Platform.OS === 'web' && loopback) return u;
  return null;
}

// ---- token storage: OS keychain/keystore on native, localStorage on web ----

async function secureGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (value) await AsyncStorage.setItem(key, value);
      else await AsyncStorage.removeItem(key);
      return;
    }
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key).catch(() => undefined);
  } catch {
    // never store tokens in plaintext AsyncStorage on native
    if (Platform.OS !== 'web') throw new Error('Unable to save login securely');
  }
}

/** Auth token for a specific user (keyed per user id — never shared device-wide). */
export async function getAuthToken(userId: string): Promise<string | null> {
  const key = tokenKeyFor(userId);
  let token = await secureGet(key);
  // One-time migration from the pre-per-user legacy key, then remove it.
  if (!token && Platform.OS !== 'web') {
    const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy) {
      token = legacy;
      await secureSet(key, legacy);
      await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    }
  }
  return token;
}

export async function setAuthToken(userId: string, token: string | null): Promise<void> {
  await secureSet(tokenKeyFor(userId), token ?? '');
}

// ---- per-user last-sync timestamps (for pull conflict detection) ----------

async function getSyncTimes(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_TIME_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function getLastSyncedAt(userId: string): Promise<string | null> {
  const times = await getSyncTimes();
  return times[userId] ?? null;
}

async function recordSyncedAt(userId: string, iso: string): Promise<void> {
  const times = await getSyncTimes();
  times[userId] = iso;
  await AsyncStorage.setItem(SYNC_TIME_KEY, JSON.stringify(times));
}

async function clearSyncedAt(userId: string): Promise<void> {
  const times = await getSyncTimes();
  delete times[userId];
  await AsyncStorage.setItem(SYNC_TIME_KEY, JSON.stringify(times));
}

export async function lastSyncedAt(userId: string): Promise<string | null> {
  return getLastSyncedAt(userId);
}

async function baseUrl(server?: string): Promise<string> {
  const base = server ?? (await getSyncServer());
  if (!base) throw new Error('No sync server configured');
  const validated = validateServerUrl(base);
  if (!validated) throw new Error('Sync server must use https://');
  return validated;
}

/** Create an account (user id + password) and return a bearer token. */
export async function registerAccount(
  server: string,
  userId: string,
  password: string,
): Promise<string> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId.trim(), password }),
  });
  const json = (await res.json().catch(() => ({}))) as { token?: string; detail?: string };
  if (!res.ok || !json.token) {
    throw new Error((json.detail as string) ?? `Registration failed (${res.status})`);
  }
  return json.token;
}

/** Log in to an existing account and return a bearer token. */
export async function loginAccount(
  server: string,
  userId: string,
  password: string,
): Promise<string> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId.trim(), password }),
  });
  const json = (await res.json().catch(() => ({}))) as { token?: string; detail?: string };
  if (!res.ok || !json.token) {
    throw new Error((json.detail as string) ?? `Login failed (${res.status})`);
  }
  return json.token;
}

/** Map the mobile UserProfile into the backend ProfileSync payload. */
function toPayload(p: UserProfile): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    name_hi: p.nameHi,
    personas: p.personas,
    conditions: p.conditions,
    activities: p.activities.map((a) => ({ type: a.type, label: a.label, label_hi: a.labelHi, time: a.time })),
    locations: p.locations.map((l) => ({ type: l.type, label: l.label })),
    city: p.city,
    language: p.language,
    behavior_bias: p.behaviorBias ?? {},
  };
}

export async function pushProfile(
  p: UserProfile,
  server?: string,
  token?: string | null,
): Promise<void> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/users/${encodeURIComponent(p.id)}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(toPayload(p)),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error((json.detail as string) ?? `Push failed (${res.status})`);
  }
  await recordSyncedAt(p.id, new Date().toISOString());
}

export type PullResult =
  | { status: 'profile'; profile: UserProfile; updatedAt: string | null }
  | { status: 'no_backup' }
  | { status: 'stale'; updatedAt: string };

/**
 * Download the profile from the server. Never overwrites a locally newer
 * profile: if the server's ``updated_at`` is not strictly newer than the last
 * local sync for this user, returns ``{ status: 'stale' }`` instead of data.
 */
export async function pullProfile(
  userId: string,
  server?: string,
  token?: string | null,
): Promise<PullResult> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/users/${encodeURIComponent(userId)}/profile`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 404) return { status: 'no_backup' };
  if (!res.ok) throw new Error(`Pull failed (${res.status})`);
  const json = (await res.json()) as { profile?: Record<string, unknown>; updated_at?: string | null };
  if (!json.profile) return { status: 'no_backup' };

  const updatedAt = json.updated_at ?? null;
  if (updatedAt) {
    const local = await getLastSyncedAt(userId);
    if (local && !isLater(updatedAt, local)) {
      return { status: 'stale', updatedAt };
    }
  }

  const d = json.profile;
  const profile: UserProfile = {
    id: (d.id as string) ?? userId,
    name: (d.name as string) ?? 'User',
    nameHi: (d.name_hi as string) ?? (d.name as string),
    personas: ((d.personas as string[]) ?? []) as UserProfile['personas'],
    conditions: (d.conditions as string[]) ?? [],
    activities: ((d.activities as Array<Record<string, unknown>>) ?? []).map((a) => ({
      type: (a.type as UserProfile['activities'][number]['type']) ?? 'walk',
      label: (a.label as string) ?? '',
      labelHi: (a.label_hi as string) ?? (a.label as string),
      time: (a.time as string) ?? '09:00',
    })),
    locations: ((d.locations as Array<Record<string, unknown>>) ?? []).map((l) => ({
      type: ((l.type as string) ?? 'home') as 'home' | 'work' | 'school' | 'farm',
      label: (l.label as string) ?? '',
    })),
    city: (d.city as string) ?? 'pune',
    language: ((d.language as string) ?? 'en') as UserProfile['language'],
    behaviorBias: (d.behavior_bias as Record<string, number>) ?? {},
  };
  if (updatedAt) await recordSyncedAt(userId, updatedAt);
  return { status: 'profile', profile, updatedAt: updatedAt ?? new Date().toISOString() };
}

/** Permanently delete the cloud backup for this user (right-to-erasure). */
export async function deleteProfile(
  userId: string,
  server?: string,
  token?: string | null,
): Promise<void> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/users/${encodeURIComponent(userId)}/profile`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 404) {
    await clearSyncedAt(userId);
    return;
  }
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  await clearSyncedAt(userId);
}

/** ISO datetime comparison with tolerance for clock skew (>=1ms later wins). */
function isLater(a: string, b: string): boolean {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return true; // unknown → allow pull
  return ta > tb;
}

/** Forget the session for a user (local logout): drop the stored cloud token
 * and the local last-sync marker. The cloud backup itself is only removed by
 * the explicit "Delete backup" action, never implicitly on logout. */
export async function logoutUser(userId: string): Promise<void> {
  await setAuthToken(userId, null);
  await clearSyncedAt(userId);
}