import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  applyPendingUpdate,
  isUpdateReadyNotification,
  isUpdatesActive,
  notifyUpdateReady,
  setLastForegroundCheck,
  shouldRunForegroundCheck,
} from '@/lib/app-updates';

function useAppUpdatesState() {
  const {
    isUpdateAvailable,
    isUpdatePending,
    isChecking,
    isDownloading,
    downloadedUpdate,
    checkError,
    downloadError,
  } = Updates.useUpdates();

  return {
    updatesEnabled: isUpdatesActive(),
    isUpdateAvailable,
    isUpdatePending,
    isUpdating: isChecking || isDownloading,
    downloadedUpdate,
    checkError,
    downloadError,
  };
}

/** Run once at the app root: foreground checks, fetch, and notification handling. */
export function useAppUpdates() {
  const {
    updatesEnabled,
    isUpdateAvailable,
    isUpdatePending,
    downloadedUpdate,
  } = useAppUpdatesState();

  const busy = useRef(false);
  const lastNotifiedUpdateId = useRef<string | null>(null);

  useEffect(() => {
    if (!updatesEnabled) return;

    let cancelled = false;

    const runForegroundCheck = async () => {
      if (busy.current || cancelled || !shouldRunForegroundCheck()) return;

      busy.current = true;
      setLastForegroundCheck();
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
      } catch (e) {
        console.warn('[updates] foreground check failed', e);
      } finally {
        busy.current = false;
      }
    };

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') void runForegroundCheck();
    };

    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [updatesEnabled]);

  useEffect(() => {
    if (!updatesEnabled || !isUpdateAvailable || isUpdatePending || busy.current) {
      return;
    }

    let cancelled = false;
    busy.current = true;

    void Updates.fetchUpdateAsync()
      .catch((e) => {
        console.warn('[updates] fetch failed', e);
      })
      .finally(() => {
        if (!cancelled) busy.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [updatesEnabled, isUpdateAvailable, isUpdatePending]);

  useEffect(() => {
    if (!updatesEnabled || !isUpdatePending) return;

    const updateId = downloadedUpdate?.updateId;
    if (!updateId || lastNotifiedUpdateId.current === updateId) return;

    lastNotifiedUpdateId.current = updateId;
    void notifyUpdateReady().catch((e) => {
      console.warn('[updates] notification failed', e);
      lastNotifiedUpdateId.current = null;
    });
  }, [updatesEnabled, isUpdatePending, downloadedUpdate]);

  useEffect(() => {
    if (!updatesEnabled) return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!isUpdateReadyNotification(data as Record<string, unknown> | undefined)) {
        return;
      }
      applyPendingUpdate();
    });

    return () => sub.remove();
  }, [updatesEnabled]);
}

/** Read update state for UI (safe to call from multiple screens). */
export function useAppUpdatesStatus() {
  const state = useAppUpdatesState();
  return {
    ...state,
    applyPendingUpdate,
  };
}
