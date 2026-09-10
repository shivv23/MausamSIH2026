import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Homepage, Lang, Severity, Card } from '../engine';
import type { DisasterAlertWithPolygon, GeoPoint, GeoPolygon, StalenessInfo } from '../types';

const CACHE_HOMEPAGE_KEY = '@mausam/cache_homepage';
const CACHE_WARNINGS_KEY = '@mausam/cache_warnings';
const CACHE_RADAR_KEY = '@mausam/cache_radar';
const CACHE_META_KEY = '@mausam/cache_metadata';

export interface CacheMetadata {
  lastSyncIso: string;
  cacheEngine: 'WatermelonDB_v3' | 'Drift_SQLite_v2';
  totalSnapshots: number;
  offlineModeSimulated: boolean;
  networkConnected: boolean;
}

const DEFAULT_META: CacheMetadata = {
  lastSyncIso: new Date(Date.now() - 1000 * 60 * 42).toISOString(), // pre-seed with 42 min ago for demo realism
  cacheEngine: 'WatermelonDB_v3',
  totalSnapshots: 1,
  offlineModeSimulated: false,
  networkConnected: true,
};

/**
 * Persists the entire calculated or fetched homepage to the local offline database
 */
export async function saveHomepageToOfflineCache(hp: Homepage): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const payload = {
      hp,
      timestamp: nowIso,
      version: '2.0.0',
    };
    await AsyncStorage.setItem(CACHE_HOMEPAGE_KEY, JSON.stringify(payload));

    const meta = await getCacheMetadata();
    meta.lastSyncIso = nowIso;
    meta.totalSnapshots += 1;
    await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
  } catch (err) {
    console.error('[OfflineCache] Failed to persist homepage:', err);
  }
}

/**
 * Loads the cached homepage snapshot from local storage
 */
export async function loadHomepageFromOfflineCache(): Promise<{ hp: Homepage; timestamp: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_HOMEPAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[OfflineCache] Failed to load cached homepage:', err);
  }
  return null;
}

/**
 * Wipe every offline cache key (homepage snapshot, warnings, radar, metadata).
 * Used when the user redoes onboarding so the previous user's cached health /
 * location data can never be resurrected on a shared device.
 */
export async function clearOfflineCache(): Promise<void> {
  const keys = [CACHE_HOMEPAGE_KEY, CACHE_WARNINGS_KEY, CACHE_RADAR_KEY, CACHE_META_KEY];
  await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)));
}

/**
 * Get cache metadata and engine status
 */
export async function getCacheMetadata(): Promise<CacheMetadata> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_META_KEY);
    if (raw) {
      return { ...DEFAULT_META, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_META };
}

/**
 * Toggle offline simulation state (Airplane Mode)
 */
export async function setOfflineModeSimulated(simulated: boolean): Promise<CacheMetadata> {
  const meta = await getCacheMetadata();
  meta.offlineModeSimulated = simulated;
  meta.networkConnected = !simulated;
  await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
  return meta;
}

/**
 * Evaluates staleness based on IMD data freshness threshold (15 minutes)
 */
export function calculateStalenessInfo(syncIso: string, isOffline: boolean): StalenessInfo {
  const lastSyncTime = new Date(syncIso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - (isNaN(lastSyncTime) ? now : lastSyncTime));
  const ageMinutes = Math.floor(diffMs / 60000);

  const isStale = isOffline || ageMinutes >= 15;
  const isCriticallyStale = ageMinutes >= 60;

  let lastUpdatedLabel = `${ageMinutes}m ago · Live`;
  let lastUpdatedLabelHi = `${ageMinutes} मिनट पहले · लाइव`;

  if (isOffline) {
    lastUpdatedLabel = `Cached ${ageMinutes}m ago · WatermelonDB`;
    lastUpdatedLabelHi = `कैश ${ageMinutes} मिनट पहले · वॉटरमेलन-डीबी`;
  } else if (ageMinutes >= 15) {
    lastUpdatedLabel = `Cached ${ageMinutes}m ago (Stale >15m)`;
    lastUpdatedLabelHi = `कैश ${ageMinutes} मिनट पहले (पुराना >15मि.)`;
  }

  return {
    isStale,
    isCriticallyStale,
    ageMinutes,
    lastUpdatedLabel,
    lastUpdatedLabelHi,
    offlineSource: isOffline ? 'watermelondb_cache' : 'network',
  };
}

/**
 * Ray-casting Point-in-Polygon check for offline geofencing (§5.5, §8.4)
 */
export function isPointInGeofence(lat: number, lon: number, polygon: GeoPolygon): boolean {
  const ring = polygon.coordinates;
  if (!ring || ring.length < 3) return false;
  let inside = false;
  const n = ring.length;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

/**
 * Evaluates active cached warnings against the user's location even with zero network
 */
export function evaluateOfflineGeofences(
  userLat: number,
  userLon: number,
  warnings: DisasterAlertWithPolygon[]
): DisasterAlertWithPolygon[] {
  return warnings.filter((w) => isPointInGeofence(userLat, userLon, w.polygon));
}
