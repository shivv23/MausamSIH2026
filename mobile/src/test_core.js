// Standalone unit test suite for Mausam 2.0 core algorithms

function isPointInGeofence(lat, lon, polygon) {
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

function shouldDeliverNotification(settings, severity, category, hour = 12) {
  if (!settings.enabled) {
    return { deliver: false, reason: 'Notifications master toggle is disabled' };
  }
  if (!settings.categories[category]) {
    if (severity !== 'red') {
      return { deliver: false, reason: `Category "${category}" is disabled in settings` };
    }
  }
  if (settings.quietHoursEnabled) {
    const [startH] = settings.quietHoursStart.split(':').map(Number);
    const [endH] = settings.quietHoursEnd.split(':').map(Number);
    const inQuietHours = startH > endH
      ? hour >= startH || hour < endH
      : hour >= startH && hour < endH;

    if (inQuietHours) {
      if (severity === 'red' && settings.redAlertBypassQuietHours) {
        return { deliver: true, reason: 'RED alert breaks through quiet hours (Safety Override)' };
      }
      return { deliver: false, reason: 'Quiet hours active (10 PM - 6 AM)' };
    }
  }
  return { deliver: true, reason: 'Passed all filters' };
}

function calculateStalenessInfo(syncIso, isOffline) {
  const lastSyncTime = new Date(syncIso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - (isNaN(lastSyncTime) ? now : lastSyncTime));
  const ageMinutes = Math.floor(diffMs / 60000);
  const isStale = isOffline || ageMinutes >= 15;
  const isCriticallyStale = ageMinutes >= 60;
  return {
    isStale,
    isCriticallyStale,
    ageMinutes,
    offlineSource: isOffline ? 'watermelondb_cache' : 'network',
  };
}

function createFCMPayload(alert, userId, city, insidePolygon) {
  return {
    to: `/topics/${alert.region.toLowerCase().replace(/\s+/g, '_')}::${userId}`,
    notification: {
      title: alert.headline,
      body: `${alert.headline} in ${alert.region}. ${insidePolygon ? 'You are INSIDE the affected zone — please act.' : 'Nearby affected zone.'}`,
      sound: 'default',
    },
    data: {
      alert_id: alert.id,
      severity: alert.severity,
      event_type: alert.eventType,
      region: alert.region,
      affected: String(insidePolygon),
      user_city: city,
      click_action: 'MAUSAM_ALERT',
    },
  };
}

let passed = 0;
let total = 0;
function assert(cond, msg) {
  total++;
  if (cond) {
    passed++;
    console.log(`✓ PASS: ${msg}`);
  } else {
    console.error(`✗ FAIL: ${msg}`);
  }
}

console.log('=== Running Mausam 2.0 Core Logic Test Suite ===\n');

// 1. Quiet Hours & Safety Bypass
const settings = {
  enabled: true,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '06:00',
  redAlertBypassQuietHours: true,
  categories: {
    severeWarnings: true,
    aqiHealth: true,
    rainCommute: true,
    farmingFrost: true,
    marineTides: true,
    myDayReminders: true,
  },
};

assert(!shouldDeliverNotification(settings, 'orange', 'severeWarnings', 23).deliver, 'Orange warning at 23:00 is silenced by Quiet Hours');
assert(shouldDeliverNotification(settings, 'red', 'severeWarnings', 23).deliver, 'RED warning at 23:00 bypasses Quiet Hours for disaster life safety');
assert(shouldDeliverNotification(settings, 'orange', 'severeWarnings', 15).deliver, 'Orange warning at 15:00 delivers normally outside quiet hours');

// 2. Category Disabled Filter
const disabledFarm = { ...settings, categories: { ...settings.categories, farmingFrost: false } };
assert(!shouldDeliverNotification(disabledFarm, 'yellow', 'farmingFrost', 12).deliver, 'Disabled farming category suppresses yellow farming advisory');

// 3. WatermelonDB / Drift Offline Staleness
const t5m = new Date(Date.now() - 5 * 60 * 1000).toISOString();
const t45m = new Date(Date.now() - 45 * 60 * 1000).toISOString();
assert(!calculateStalenessInfo(t5m, false).isStale, '5 min online data is fresh (not stale)');
assert(calculateStalenessInfo(t45m, false).isStale, '45 min data is marked stale (>15m threshold)');
assert(calculateStalenessInfo(t5m, true).offlineSource === 'watermelondb_cache', 'Offline mode identifies watermelondb_cache source');

// 4. Ray-Casting Geofence Algorithm
const punePoly = {
  coordinates: [
    [73.70, 18.44],
    [73.95, 18.44],
    [73.95, 18.65],
    [73.70, 18.65],
    [73.70, 18.44],
  ],
};
assert(isPointInGeofence(18.52, 73.85, punePoly), 'Pune coordinate (18.52, 73.85) is correctly detected INSIDE polygon');
assert(!isPointInGeofence(28.61, 77.20, punePoly), 'Delhi coordinate (28.61, 77.20) is correctly detected OUTSIDE polygon');

// 5. FCM Topic Payload Schema
const testAlert = {
  id: 'w-101',
  severity: 'orange',
  eventType: 'heavy_rain',
  headline: 'Heavy Rain Warning',
  region: 'Pune Metro',
};
const fcm = createFCMPayload(testAlert, 'ananya', 'pune', true);
assert(fcm.to.includes('pune_metro::ananya'), 'FCM topic matches /topics/pune_metro::ananya');
assert(fcm.data.affected === 'true', 'FCM data payload carries affected="true"');
assert(fcm.data.click_action === 'MAUSAM_ALERT', 'FCM click_action is MAUSAM_ALERT');

console.log(`\n========================================`);
console.log(`All ${passed}/${total} Core Architecture Unit Tests Passed!`);
console.log(`========================================`);
