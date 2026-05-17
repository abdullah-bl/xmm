import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

import { storage } from '@/lib/storage';

const APP_NAME = Constants.expoConfig?.name ?? 'the app';
const LAST_FOREGROUND_CHECK_KEY = 'updates:lastForegroundCheck';

export const FOREGROUND_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const UPDATE_READY_NOTIFICATION_TYPE = 'update-ready';

export function isUpdatesActive(): boolean {
  return !__DEV__ && Updates.isEnabled;
}

export function getLastForegroundCheck(): number | null {
  const value = storage.get<number | null>(LAST_FOREGROUND_CHECK_KEY, null);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function setLastForegroundCheck(timestamp = Date.now()): void {
  storage.set(LAST_FOREGROUND_CHECK_KEY, timestamp);
}

export function shouldRunForegroundCheck(now = Date.now()): boolean {
  const last = getLastForegroundCheck();
  if (last == null) return true;
  return now - last >= FOREGROUND_CHECK_INTERVAL_MS;
}

export function applyPendingUpdate(): void {
  if (!isUpdatesActive()) return;

  Alert.alert('Update ready', `Restart ${APP_NAME} to load the latest version.`, [
    { text: 'Later', style: 'cancel' },
    {
      text: 'Restart now',
      onPress: () => {
        Updates.reloadAsync().catch(() => {});
      },
    },
  ]);
}

export function isUpdateReadyNotification(
  data: Record<string, unknown> | undefined,
): boolean {
  return data?.type === UPDATE_READY_NOTIFICATION_TYPE;
}

export async function notifyUpdateReady(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Update ready',
      body: `Restart ${APP_NAME} to load the latest version.`,
      data: { type: UPDATE_READY_NOTIFICATION_TYPE },
    },
    trigger: null,
  });
}
