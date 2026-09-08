import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '../engine';

const SERVER_KEY = '@mausam/sync_server';
const TOKEN_KEY = '@mausam/sync_token';

export async function getSyncServer(): Promise<string | null> {
  return AsyncStorage.getItem(SERVER_KEY);
}

export async function setSyncServer(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  if (clean) await AsyncStorage.setItem(SERVER_KEY, clean);
  else await AsyncStorage.removeItem(SERVER_KEY);
}

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setAuthToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function baseUrl(server?: string): Promise<string> {
  const base = server ?? (await getSyncServer());
  if (!base) throw new Error('No sync server configured');
  return base.replace(/\/+$/, '');
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
  if (!res.ok) throw new Error(`Push failed (${res.status})`);
}

/** Download the profile from the server. Returns null when nothing is saved yet. */
export async function pullProfile(
  userId: string,
  server?: string,
  token?: string | null,
): Promise<UserProfile | null> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/users/${encodeURIComponent(userId)}/profile`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Pull failed (${res.status})`);
  const json = (await res.json()) as { profile?: Record<string, unknown> };
  if (!json.profile) return null;
  const d = json.profile;
  return {
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
}