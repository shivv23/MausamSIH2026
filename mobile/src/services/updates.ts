import * as Updates from 'expo-updates';

export type UpdateCheckResult = 'none' | 'updated' | 'unavailable' | 'failed';

/**
 * Check the EAS update channel and, when a newer build is available, download
 * it so it applies on the next cold start (or after reloadUpdate()).
 *
 * Returns 'unavailable' in dev/Expo Go where Updates is disabled so callers
 * can surface a human explainer instead of a scary error.
 */
export async function checkForUpdates(silent = false): Promise<UpdateCheckResult> {
  try {
    if (!Updates.isEnabled) return 'unavailable';
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return 'none';
    await Updates.fetchUpdateAsync();
    return 'updated';
  } catch {
    return silent ? 'none' : 'failed';
  }
}

/** Apply a downloaded update immediately (used by the manual check button). */
export async function reloadUpdate(): Promise<void> {
  await Updates.reloadAsync();
}