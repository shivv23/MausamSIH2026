import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { UserProfile } from '../engine';
import {
  parseAccountExport,
  parseAuthSession,
  parseNotificationList,
  parseProfileSync,
} from '../api/contract';
import { kvGet, kvGetJson, kvRemove, kvSet, kvSetJson } from './db';

const SERVER_KEY = '@mausam/sync_server';
const LEGACY_TOKEN_KEY = '@mausam/sync_token';
const SYNC_TIME_KEY = '@mausam/sync_times';

const tokenKeyFor = (userId: string) => `mausam_sync_token_${userId}`;

const secureGet = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') return kvGet(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const secureSet = async (key: string, value: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (value) await kvSet(key, value);
      else await kvRemove(key);
      return;
    }
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key).catch(() => undefined);
  } catch {
    // never store tokens in plaintext AsyncStorage on native
    if (Platform.OS !== 'web') throw new Error('Unable to save login securely');
  }
};

export async function getSyncServer(): Promise<string | null> {
  return kvGet(SERVER_KEY);
}

export async function setSyncServer(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean) {
    await kvRemove(SERVER_KEY);
    return;
  }
  const validated = validateServerUrl(clean);
  if (!validated) {
    throw new Error('Sync server must use https:// (http:// only for localhost in development)');
  }
  await kvSet(SERVER_KEY, validated);
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

// ---- session expiry: 401s invalidate the local token & force re-login ----

/** Raised when the sync server rejects our bearer token (revoked/expired). */
export class AuthExpiredError extends Error {
  readonly sessionExpired = true;
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

type SessionExpiredListener = (userId: string) => void;
const sessionExpiredListeners: SessionExpiredListener[] = [];

/** Subscribe to session-expiry events (fires when any protected call gets a
 * 401). Returns an unsubscribe function. Used by App.tsx to route the user
 * back to the auth gate automatically. */
export function subscribeSessionExpired(cb: SessionExpiredListener): () => void {
  sessionExpiredListeners.push(cb);
  return () => {
    const i = sessionExpiredListeners.indexOf(cb);
    if (i >= 0) sessionExpiredListeners.splice(i, 1);
  };
}

function emitSessionExpired(userId: string): void {
  for (const cb of sessionExpiredListeners) cb(userId);
}

/** On a 401, drop the stored token for this user, notify the app to re-auth,
 * and throw a typed {@link AuthExpiredError} to the caller. Safe to call for
 * every protected endpoint after `fetch` resolves. */
function guard(res: Response, userId: string): void {
  if (res.status === 401) {
    void setAuthToken(userId, null);
    emitSessionExpired(userId);
    throw new AuthExpiredError(`Session expired for ${userId}`);
  }
}

// ---- token storage: OS keychain/keystore on native, SQLite web fallback ----

/** Auth token for a specific user (keyed per user id — never shared device-wide). */
export async function getAuthToken(userId: string): Promise<string | null> {
  const key = tokenKeyFor(userId);
  let token = await secureGet(key);
  // One-time migration from the pre-per-user legacy key, then remove it.
  if (!token && Platform.OS !== 'web') {
    const legacy = await kvGet(LEGACY_TOKEN_KEY);
    if (legacy) {
      token = legacy;
      await secureSet(key, legacy);
      await kvRemove(LEGACY_TOKEN_KEY);
    }
  }
  return token;
}

export async function setAuthToken(userId: string, token: string | null): Promise<void> {
  await secureSet(tokenKeyFor(userId), token ?? '');
}

// ---- per-user last-sync timestamps (for pull conflict detection) ----------

async function getSyncTimes(): Promise<Record<string, string>> {
  return (await kvGetJson<Record<string, string>>(SYNC_TIME_KEY)) ?? {};
}

async function getLastSyncedAt(userId: string): Promise<string | null> {
  const times = await getSyncTimes();
  return times[userId] ?? null;
}

async function recordSyncedAt(userId: string, iso: string): Promise<void> {
  const times = await getSyncTimes();
  times[userId] = iso;
  await kvSetJson(SYNC_TIME_KEY, times);
}

async function clearSyncedAt(userId: string): Promise<void> {
  const times = await getSyncTimes();
  delete times[userId];
  await kvSetJson(SYNC_TIME_KEY, times);
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

export interface AuthSession {
  token: string;
  verified: boolean;
  contactVerificationRequired: boolean;
  message: string;
}

/** Create an account (user id + password + optional contact) and get a token. */
export async function registerAccount(
  server: string,
  userId: string,
  password: string,
  contact?: { email?: string; phone?: string },
): Promise<AuthSession> {
  const base = await baseUrl(server);
  const body: Record<string, unknown> = { user_id: userId.trim(), password };
  if (contact?.email) body.email = contact.email;
  if (contact?.phone) body.phone = contact.phone;
  const res = await fetch(`${base}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseAuthResponse(res, 'Registration failed');
}

/** Log in to an existing account and return a bearer token. */
export async function loginAccount(
  server: string,
  userId: string,
  password: string,
): Promise<AuthSession> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId.trim(), password }),
  });
  return parseAuthResponse(res, 'Login failed');
}

async function parseAuthResponse(res: Response, fallback: string): Promise<AuthSession> {
  const json = (await res.json().catch(() => ({}))) as Partial<AuthSession> & { detail?: string; user_id?: string };
  if (!res.ok || !json.token) {
    throw new Error(json.detail ?? `${fallback} (${res.status})`);
  }
  return parseAuthSession(json);
}

/** Request a one-time-password for contact verification or password recovery. */
export async function requestOtp(
  server: string,
  userId: string,
  purpose: 'verify_email' | 'verify_phone' | 'reset_password',
  contact?: string,
): Promise<{ sentTo?: string; ttlMinutes: number; devCode?: string }> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId.trim(), purpose, contact }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    dev_code?: string; sent_to?: string; ttl_minutes?: number; detail?: string;
  };
  if (!res.ok) throw new Error(json.detail ?? `OTP request failed (${res.status})`);
  return { sentTo: json.sent_to, ttlMinutes: json.ttl_minutes ?? 10, devCode: json.dev_code };
}

/** Verify a one-time-password (binds a verified contact, returns a token). */
export async function verifyOtp(
  server: string,
  userId: string,
  purpose: 'verify_email' | 'verify_phone',
  code: string,
): Promise<AuthSession> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId.trim(), purpose, code }),
  });
  return parseAuthResponse(res, 'Verification failed');
}

/** Recover an account with a reset OTP (invalidates all prior sessions). */
export async function resetPassword(
  server: string,
  userId: string,
  code: string,
  newPassword: string,
): Promise<AuthSession> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId.trim(), code, new_password: newPassword }),
  });
  return parseAuthResponse(res, 'Password reset failed');
}

/** Revoke every session for the account (sign out everywhere). */
export async function logoutAllDevices(
  server: string,
  userId: string,
  token: string,
): Promise<AuthSession> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/auth/logout-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  guard(res, userId);
  return parseAuthResponse(res, 'Sign-out failed');
}

/** Permanently delete the account (right-to-erasure under DPDP). */
export async function deleteAccount(
  server: string,
  userId: string,
  token: string,
): Promise<void> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/auth/account`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  guard(res, userId);
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(json.detail ?? `Account deletion failed (${res.status})`);
  }
  await setAuthToken(userId, null);
  await clearSyncedAt(userId);
}

/** Register this device for server-push with the backend. */
export async function registerPushToken(
  server: string,
  userId: string,
  token: string,
  expoPushToken: string,
  platform: 'android' | 'ios',
): Promise<void> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/users/${encodeURIComponent(userId)}/push-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ token: expoPushToken, platform }),
  });
  guard(res, userId);
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(json.detail ?? `Push registration failed (${res.status})`);
  }
}

/** Unregister this device from server-push. */
export async function unregisterPushToken(
  server: string,
  userId: string,
  token: string,
  expoPushToken: string,
): Promise<void> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/users/${encodeURIComponent(userId)}/push-token`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ token: expoPushToken }),
  });
  guard(res, userId);
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(json.detail ?? `Push unregister failed (${res.status})`);
  }
}

export interface ServerNotification {
  id: string;
  alertId: string;
  severity: 'green' | 'yellow' | 'orange' | 'red';
  eventType: string;
  headline: string;
  body: string;
  region: string;
  read: boolean;
  createdAt: string;
}

/** Pull the durable alert inbox from the server (in-app notification centre). */
export async function fetchNotifications(
  server: string,
  userId: string,
  token: string,
): Promise<{ unread: number; items: ServerNotification[] }> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/users/${encodeURIComponent(userId)}/notifications`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  guard(res, userId);
  const json = (await res.json().catch(() => ({}))) as {
    unread?: number; items?: unknown[]; detail?: string;
  };
  if (!res.ok) throw new Error(json.detail ?? `Fetching notifications failed (${res.status})`);
  const contract = parseNotificationList(json);
  const items: ServerNotification[] = contract.items.map((n) => ({
    id: n.id || n.alert_id,
    alertId: n.alert_id,
    severity: n.severity,
    eventType: n.event_type,
    headline: n.headline,
    body: n.body,
    region: n.region,
    read: n.read,
    createdAt: n.created_at,
  }));
  return { unread: contract.unread, items };
}

/** Mark one server notification read. */
export async function ackNotification(
  server: string,
  userId: string,
  token: string,
  notificationId: string,
): Promise<void> {
  const base = await baseUrl(server);
  const res = await fetch(
    `${base}/api/v1/users/${encodeURIComponent(userId)}/notifications/${encodeURIComponent(notificationId)}/ack`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
  );
  guard(res, userId);
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(json.detail ?? `Ack failed (${res.status})`);
  }
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

/** DPDP portability: fetch everything the server holds for this account. */
export async function exportAccount(
  userId: string,
  server?: string,
  token?: string | null,
): Promise<unknown> {
  const base = await baseUrl(server);
  const res = await fetch(`${base}/api/v1/users/${encodeURIComponent(userId)}/export`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  guard(res, userId);
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return parseAccountExport(await res.json());
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
  guard(res, p.id);
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
  guard(res, userId);
  if (res.status === 404) return { status: 'no_backup' };
  if (!res.ok) throw new Error(`Pull failed (${res.status})`);
  const json = (await res.json()) as Record<string, unknown>;
  if (!json.profile) return { status: 'no_backup' };
  const contract = parseProfileSync(json);
  const updatedAt = contract.updated_at ?? null;
  if (updatedAt) {
    const local = await getLastSyncedAt(userId);
    if (local && !isLater(updatedAt, local)) {
      return { status: 'stale', updatedAt };
    }
  }

  const d = contract.profile;
  const profile: UserProfile = {
    id: d.id || userId,
    name: d.name || 'User',
    nameHi: d.name_hi ?? d.name,
    personas: d.personas as UserProfile['personas'],
    conditions: d.conditions,
    activities: d.activities.map((a) => ({
      type: (a.type as UserProfile['activities'][number]['type']) ?? 'walk',
      label: a.label,
      labelHi: a.label_hi ?? a.label,
      time: a.time,
    })),
    locations: d.locations.map((l) => ({
      type: (l.type as 'home' | 'work' | 'school' | 'farm') ?? 'home',
      label: l.label,
    })),
    city: d.city,
    language: d.language,
    behaviorBias: d.behavior_bias ?? {},
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
  guard(res, userId);
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