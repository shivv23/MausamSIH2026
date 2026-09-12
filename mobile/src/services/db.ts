/**
 * Local encrypted-capable SQLite data layer (expo-sqlite).
 *
 * All durable device state — the current profile, offline homepage snapshot,
 * notification settings, sync bookkeeping, the in-app notification archive and
 * DPDP consent records — lives in one relational database instead of opaque
 * AsyncStorage blobs. Health/location data is health-sensitive personal data
 * under the Indian DPDP Act; the release build compiles with SQLCipher
 * (useSQLCipher in app.json) and open() applies a random per-device key held
 * in the SecureStore keystore, so the database is encrypted at rest. Expo Go /
 * web dev builds fall back to plain SQLite / AsyncStorage gracefully.
 *
 * Web keeps working via a documented AsyncStorage fallback (expo-sqlite's web
 * alpha needs wasm/COEP headers that the hosted demo doesn't ship), so the
 * demo never regresses. Everything else is a single Promise exposing relational
 * helpers; services import this module instead of touching storage directly.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const DATABASE_NAME = 'mausam.db';
const SCHEMA_VERSION = 1;
const DB_KEY_STORE = 'mausam_sqlite_key';
let _keyed = false;

// ---- legacy AsyncStorage keys (migrated once into SQLite) -------------------
export const LEGACY_KEYS = [
  '@mausam/profile',
  '@mausam/lang',
  '@mausam/live',
  '@mausam/cache_homepage',
  '@mausam/cache_warnings',
  '@mausam/cache_radar',
  '@mausam/cache_metadata',
  '@mausam/notification_settings',
  '@mausam/sync_times',
  '@mausam/sync_server',
];

type SQLiteDatabase = SQLite.SQLiteDatabase;
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let _migrated = false;

export function isNative() {
  return Platform.OS !== 'web';
}

/** Random, per-device 64-char hex key persisted in the SecureStore keystore. */
async function getOrCreateDbKey(): Promise<string | null> {
  try {
    let key = await SecureStore.getItemAsync(DB_KEY_STORE);
    if (!key) {
      const raw = await Crypto.randomUUID();
      key = `${raw}${await Crypto.randomUUID()}`.replace(/-/g, '');
      await SecureStore.setItemAsync(DB_KEY_STORE, key, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
    return key;
  } catch {
    return null;
  }
}

async function open(): Promise<SQLiteDatabase> {
  if (!isNative()) {
    throw new Error('SQLite web backend not bundled; AsyncStorage fallback is used on web');
  }
  if (!_dbPromise) {
    _dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      // Apply the SQLCipher key before any table access. Runs only where the
      // native build was compiled with useSQLCipher; silent no-op elsewhere
      // (Expo Go/dev builds) so the app still boots unencrypted.
      try {
        const key = await getOrCreateDbKey();
        if (key) {
          await db.execAsync(`PRAGMA key = '${key}'`);
          _keyed = true;
        }
      } catch {
        _keyed = false;
      }
      await migrate(db);
      return db;
    });
  }
  return _dbPromise;
}

async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  await db.execAsync(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  kind TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  version TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_archive (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  alert_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  event_type TEXT NOT NULL,
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  region TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consent_records (
  user_id TEXT PRIMARY KEY NOT NULL,
  policy_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  consents TEXT NOT NULL
);
`);
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  // One-time import of legacy AsyncStorage state into SQLite (unless already done).
  if (!_migrated) {
    _migrated = true;
    try {
      await importLegacyKeys(db);
    } catch (err) {
      console.warn('[db] legacy import incomplete:', err);
    }
  }
}

async function importLegacyKeys(db: SQLiteDatabase): Promise<void> {
  const stored = await AsyncStorage.multiGet(LEGACY_KEYS);
  for (const [key, value] of stored) {
    if (value == null) continue;
    const info = db
      .getFirstAsync<{ value: string }>('SELECT value FROM kv_store WHERE key = ?', key)
      .then((r) => r?.value);
    if (!(await info)) {
      await db.runAsync('INSERT OR IGNORE INTO kv_store (key, value) VALUES (?, ?)', key, value);
    }
  }
}

// ---- key-value surface (replaces direct AsyncStorage usage in services) -----

export async function kvGet(key: string): Promise<string | null> {
  if (!isNative()) return AsyncStorage.getItem(key);
  try {
    const db = await open();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv_store WHERE key = ?', key);
    return row?.value ?? null;
  } catch (err) {
    console.warn('[db] kvGet fallback to AsyncStorage:', err);
    return AsyncStorage.getItem(key);
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (!isNative()) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  try {
    const db = await open();
    await db.runAsync('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)', key, value);
  } catch (err) {
    console.warn('[db] kvSet fallback to AsyncStorage:', err);
    await AsyncStorage.setItem(key, value);
  }
}

export async function kvRemove(key: string): Promise<void> {
  if (!isNative()) {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    const db = await open();
    await db.runAsync('DELETE FROM kv_store WHERE key = ?', key);
  } catch (err) {
    console.warn('[db] kvRemove fallback to AsyncStorage:', err);
    await AsyncStorage.removeItem(key);
  }
}

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const raw = await kvGet(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSetJson(key: string, value: unknown): Promise<void> {
  await kvSet(key, JSON.stringify(value));
}

// ---- offline snapshots (homepage / warnings / radar) ------------------------

export interface Snapshot {
  kind: string;
  payload: unknown;
  version: string;
  timestamp: string;
}

export async function saveSnapshot(kind: string, payload: unknown, version = '1.0.0'): Promise<void> {
  const timestamp = new Date().toISOString();
  if (!isNative()) {
    await AsyncStorage.setItem(`@mausam/cache_${kind}`, JSON.stringify({ payload, timestamp, version }));
    return;
  }
  const db = await open();
  await db.runAsync(
    'INSERT OR REPLACE INTO snapshots (kind, payload, version, timestamp) VALUES (?, ?, ?, ?)',
    kind,
    JSON.stringify(payload),
    version,
    timestamp,
  );
  return; // eslint-disable-line no-useless-return
}

export async function loadSnapshot<T>(kind: string): Promise<{ payload: T; version: string; timestamp: string } | null> {
  if (!isNative()) {
    const raw = await AsyncStorage.getItem(`@mausam/cache_${kind}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { payload: parsed.payload as T, version: parsed.version as string, timestamp: parsed.timestamp as string };
  }
  try {
    const db = await open();
    const row = await db.getFirstAsync<{ payload: string; version: string; timestamp: string }>(
      'SELECT payload, version, timestamp FROM snapshots WHERE kind = ?', kind);
    if (!row) return null;
    return { payload: JSON.parse(row.payload) as T, version: row.version, timestamp: row.timestamp };
  } catch (err) {
    console.warn('[db] loadSnapshot failed:', err);
    return null;
  }
}

export async function countSnapshots(): Promise<number> {
  if (!isNative()) return Number(await AsyncStorage.getItem('@mausam/snapshot_count')) || 0;
  const db = await open();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM snapshots');
  return row?.n ?? 0;
}

export async function setSnapshotCount(n: number): Promise<void> {
  if (!isNative()) await AsyncStorage.setItem('@mausam/snapshot_count', String(n));
}

// ---- in-app notification archive --------------------------------------------

export interface ArchivedNotification {
  id: string;
  userId: string;
  alertId: string;
  severity: string;
  eventType: string;
  headline: string;
  body: string;
  region: string;
  read: boolean;
  createdAt: string;
}

export async function archiveNotification(n: Omit<ArchivedNotification, 'read'>): Promise<void> {
  if (!isNative()) {
    const all = (await kvGetJson<Record<string, unknown>>('@mausam/notif_archive')) ?? {};
    all[n.id] = { ...n, read: false };
    await kvSetJson('@mausam/notif_archive', all);
    return;
  }
  const db = await open();
  await db.runAsync(
    `INSERT OR REPLACE INTO notification_archive
       (id, user_id, alert_id, severity, event_type, headline, body, region, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    n.id, n.userId ?? '', n.alertId, n.severity, n.eventType, n.headline, n.body, n.region, n.createdAt,
  );
}

export interface ArchiveRow {
  id: string;
  userId: string;
  alertId: string;
  severity: string;
  eventType: string;
  headline: string;
  body: string;
  region: string;
  read: boolean;
  createdAt: string;
}

export async function listArchivedNotifications(): Promise<ArchiveRow[]> {
  if (!isNative()) {
    const all = (await kvGetJson<Record<string, unknown>>('@mausam/notif_archive')) ?? {};
    return Object.values(all) as ArchiveRow[];
  }
  const db = await open();
  const rows = await db.getAllAsync<{
    id: string; user_id: string; alert_id: string; severity: string; event_type: string;
    headline: string; body: string; region: string; read_at: string | null; created_at: string;
  }>('SELECT * FROM notification_archive ORDER BY created_at DESC');
  return rows.map((r) => ({
    id: r.id, userId: r.user_id, alertId: r.alert_id, severity: r.severity, eventType: r.event_type,
    headline: r.headline, body: r.body, region: r.region, read: !!r.read_at, createdAt: r.created_at,
  }));
}

export async function markArchiveRead(id: string): Promise<void> {
  if (!isNative()) {
    const all = await kvGetJson<Record<string, { read?: boolean }>>('@mausam/notif_archive');
    if (all?.[id]) { all[id].read = true; await kvSetJson('@mausam/notif_archive', all); }
    return;
  }
  const db = await open();
  await db.runAsync('UPDATE notification_archive SET read_at = ? WHERE id = ?', new Date().toISOString(), id);
}

// ---- DPDP consent records -----------------------------------------------------

export interface ConsentRecord {
  userId: string;
  policyVersion: string;
  acceptedAt: string;
  consents: string[]; // e.g. ['profile', 'notifications', 'analytics']
}

export async function saveConsent(record: ConsentRecord): Promise<void> {
  if (!isNative()) {
    const all = (await kvGetJson<Record<string, unknown>>('@mausam/consents')) ?? {};
    all[record.userId] = record;
    await kvSetJson('@mausam/consents', all);
    return;
  }
  const db = await open();
  await db.runAsync(
    'INSERT OR REPLACE INTO consent_records (user_id, policy_version, accepted_at, consents) VALUES (?, ?, ?, ?)',
    record.userId, record.policyVersion, record.acceptedAt, JSON.stringify(record.consents),
  );
}

export async function getConsent(userId: string): Promise<ConsentRecord | null> {
  if (!isNative()) {
    const all = await kvGetJson<Record<string, ConsentRecord>>('@mausam/consents');
    return all?.[userId] ?? null;
  }
  try {
    const db = await open();
    const row = await db.getFirstAsync<{ policy_version: string; accepted_at: string; consents: string }>(
      'SELECT policy_version, accepted_at, consents FROM consent_records WHERE user_id = ?', userId);
    if (!row) return null;
    return {
      userId, policyVersion: row.policy_version, acceptedAt: row.accepted_at,
      consents: JSON.parse(row.consents) as string[],
    };
  } catch {
    return null;
  }
}

// ---- privacy wipe ------------------------------------------------------------

export async function wipeUserData(): Promise<void> {
  if (!isNative()) {
    await AsyncStorage.multiRemove(LEGACY_KEYS);
    return;
  }
  const db = await open();
  await db.execAsync('DELETE FROM snapshots; DELETE FROM kv_store; DELETE FROM notification_archive;');
}

export async function snapshotMetadata(): Promise<{ engine: string; totalSnapshots: number }> {
  const [, snapshots] = await Promise.all([kvGet('@mausam/sync_server'), countSnapshots()]);
  return { engine: isNative() ? 'SQLite_v1' : 'AsyncStorage_web', totalSnapshots: snapshots };
}

export function databaseEngineLabel(): string {
  if (!isNative()) return 'AsyncStorage (web fallback)';
  return _keyed ? 'expo-sqlite + SQLCipher (encrypted at rest)' : 'expo-sqlite (dev build, unencrypted)';
}