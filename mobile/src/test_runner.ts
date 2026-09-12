import { shouldDeliverNotification, createFCMPayload } from './services/notifications';
import { calculateStalenessInfo, isPointInGeofence } from './services/offlineCache';
import { DEFAULT_NOTIFICATION_SETTINGS } from './types';
import type { DisasterAlertWithPolygon, GeoPolygon } from './types';

function runTests() {
  console.log('--- Starting Mausam 2.0 Test Suite ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✓ PASS: ${name}`);
    } else {
      console.error(`✗ FAIL: ${name}`);
    }
  }

  // TEST 1: Alert Orchestrator Quiet Hours & RED bypass
  const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '06:00' };

  // 1a: Orange alert at 23:30 during quiet hours should be suppressed
  const orangeResult = shouldDeliverNotification(settings, 'orange', 'severeWarnings', 23);
  assert(!orangeResult.deliver, 'Orange alert at 23:00 should be suppressed during quiet hours');

  // 1b: Red disaster alert at 23:30 MUST bypass quiet hours (life safety guarantee)
  const redResult = shouldDeliverNotification(settings, 'red', 'severeWarnings', 23);
  assert(redResult.deliver, 'RED alert at 23:00 MUST bypass quiet hours for life safety');

  // 1c: Orange alert at 14:00 outside quiet hours should deliver
  const dayResult = shouldDeliverNotification(settings, 'orange', 'severeWarnings', 14);
  assert(dayResult.deliver, 'Orange alert at 14:00 should deliver normally');

  // TEST 2: Category Filter
  const disabledFarmSettings = {
    ...settings,
    categories: { ...settings.categories, farmingFrost: false },
  };
  const farmResult = shouldDeliverNotification(disabledFarmSettings, 'yellow', 'farmingFrost', 10);
  assert(!farmResult.deliver, 'Farming alert should be blocked when category is disabled');

  // TEST 3: Staleness Evaluation (§8.4)
  const freshTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const freshInfo = calculateStalenessInfo(freshTime, false);
  assert(!freshInfo.isStale && freshInfo.ageMinutes === 5, '5m old online data should be fresh');

  const staleTime = new Date(Date.now() - 25 * 60 * 1000).toISOString();
  const staleInfo = calculateStalenessInfo(staleTime, false);
  assert(staleInfo.isStale && staleInfo.ageMinutes === 25, '25m old data should be flagged stale');

  const offlineInfo = calculateStalenessInfo(freshTime, true);
  assert(offlineInfo.isStale && offlineInfo.offlineSource === 'sqlite_cache', 'Offline mode must use sqlite_cache');

  // TEST 4: Ray-Casting Point-in-Polygon Geofence (§5.5)
  // Polygon roughly covering Pune Metro: [ [73.70, 18.44], [73.95, 18.44], [73.95, 18.65], [73.70, 18.65], [73.70, 18.44] ]
  const punePoly: GeoPolygon = {
    coordinates: [
      [73.70, 18.44],
      [73.95, 18.44],
      [73.95, 18.65],
      [73.70, 18.65],
      [73.70, 18.44],
    ],
  };

  // Pune city center: lat 18.52, lon 73.85
  const inPune = isPointInGeofence(18.52, 73.85, punePoly);
  assert(inPune, 'Point (18.52, 73.85) inside Pune polygon should return TRUE');

  // Delhi: lat 28.61, lon 77.20
  const inDelhi = isPointInGeofence(28.61, 77.20, punePoly);
  assert(!inDelhi, 'Point (28.61, 77.20) outside Pune polygon should return FALSE');

  // TEST 5: Canonical FCM Payload Generation
  const dummyAlert: DisasterAlertWithPolygon = {
    id: 'w-test-101',
    severity: 'orange',
    eventType: 'heavy_rain',
    source: 'IMD',
    headline: 'Heavy Rain Warning',
    headlineHi: 'भारी बारिश चेतावनी',
    body: '45 mm/h rain expected.',
    bodyHi: '45 मिमी/घंटा बारिश।',
    region: 'Pune Metro',
    center: { lat: 18.52, lon: 73.85 },
    radiusKm: 40,
    polygon: punePoly,
    issuedAt: new Date().toISOString(),
    validUntil: new Date().toISOString(),
    actions: ['Avoid underpasses'],
    actionsHi: ['अंडरपास से बचें'],
  };

  const fcmPayload = createFCMPayload(dummyAlert, 'ananya', 'pune', true);
  assert(fcmPayload.to === '/topics/pune_metro::ananya', 'FCM topic matches pattern /topics/region::user');
  assert(fcmPayload.data.affected === 'true', 'FCM payload carries affected=true');
  assert(fcmPayload.data.click_action === 'MAUSAM_ALERT', 'FCM payload carries click_action=MAUSAM_ALERT');

  console.log(`\n=== Test Results: ${passed}/${total} Passed ===`);
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runTests();
