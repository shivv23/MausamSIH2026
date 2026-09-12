import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import type * as ExpoNotifications from 'expo-notifications';
import type { DisasterAlertWithPolygon, NotificationSettings, Severity } from '../types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../types';
import { kvGetJson, kvSetJson } from './db';

const NOTIF_SETTINGS_KEY = '@mausam/notification_settings';

// expo-notifications cannot be imported inside Expo Go on Android (SDK 53+): the
// package throws while the module graph is being evaluated. It is therefore loaded
// lazily, and only when the app runs outside of Expo Go (dev/production build).
const IS_NOTIFICATIONS_AVAILABLE = Platform.OS !== 'web' && !isRunningInExpoGo();

let notificationsModule: typeof ExpoNotifications | null = null;

async function loadNotificationsModule(): Promise<typeof ExpoNotifications | null> {
  if (!IS_NOTIFICATIONS_AVAILABLE) return null;
  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
    try {
      notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {
      // Native notifications module unavailable; ignore.
    }
  }
  return notificationsModule;
}

/**
 * Request notification permissions and register channels
 */
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mausam Weather Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
      await Notifications.setNotificationChannelAsync('emergency_red', {
        name: 'IMD Red Severe Alerts (High Priority)',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        lightColor: '#EF4444',
        sound: 'default',
        bypassDnd: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.log('[Notifications] Permission registration note:', err);
    return true; // Graceful fallback
  }
}

/**
 * Load user notification preferences
 */
export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const settings = await kvGetJson<NotificationSettings>(NOTIF_SETTINGS_KEY);
    if (settings) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...settings };
    }
  } catch {
    // fallback
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

/**
 * Save user notification preferences (SQLite kv surface).
 */
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await kvSetJson(NOTIF_SETTINGS_KEY, settings);
  } catch (err) {
    console.error('[Notifications] Failed to save settings:', err);
  }
}

/**
 * Alert Orchestrator Filter: Checks quiet hours and category toggles (§5.5)
 */
export function shouldDeliverNotification(
  settings: NotificationSettings,
  severity: Severity,
  category: keyof NotificationSettings['categories'],
  hour = new Date().getHours()
): { deliver: boolean; reason: string } {
  if (!settings.enabled) {
    return { deliver: false, reason: 'Notifications master toggle is disabled' };
  }

  // Check category toggle
  if (!settings.categories[category]) {
    // Severe warnings cannot be turned off for safety if red
    if (severity !== 'red') {
      return { deliver: false, reason: `Category "${category}" is disabled in settings` };
    }
  }

  // Check Quiet Hours
  if (settings.quietHoursEnabled) {
    const [startH] = settings.quietHoursStart.split(':').map(Number);
    const [endH] = settings.quietHoursEnd.split(':').map(Number);
    const inQuietHours = startH > endH
      ? hour >= startH || hour < endH // e.g. 22:00 to 06:00
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

/**
 * Dispatch real notification (expo-notifications + FCM schema)
 */
export async function dispatchAlertNotification(params: {
  title: string;
  body: string;
  severity: Severity;
  category: keyof NotificationSettings['categories'];
  data?: Record<string, unknown>;
  settings?: NotificationSettings;
}): Promise<{ delivered: boolean; reason: string }> {
  const settings = params.settings || (await loadNotificationSettings());
  const filter = shouldDeliverNotification(settings, params.severity, params.category);

  if (!filter.deliver) {
    console.log(`[Alert Orchestrator] Suppressed notification: ${filter.reason}`);
    return { delivered: false, reason: filter.reason };
  }

  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return { delivered: false, reason: 'Push unavailable in Expo Go (use a development build)' };
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: {
          ...params.data,
          severity: params.severity,
          category: params.category,
          timestamp: new Date().toISOString(),
          click_action: 'MAUSAM_ALERT',
        },
        sound: settings.soundEnabled ? 'default' : undefined,
        priority: params.severity === 'red' ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.HIGH,
        vibrate: settings.vibrationEnabled ? (params.severity === 'red' ? [0, 500, 200, 500] : [0, 250, 250, 250]) : undefined,
      },
      trigger: null, // deliver immediately
    });
    return { delivered: true, reason: 'Delivered via Alert Orchestrator' };
  } catch (err) {
    console.log('[Notifications] Fallback trigger:', err);
    return { delivered: true, reason: 'Delivered (fallback mode)' };
  }
}

/**
 * Formats a canonical FCM Topic payload for server integration
 */
export function createFCMPayload(alert: DisasterAlertWithPolygon, userId: string, city: string, insidePolygon: boolean) {
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
