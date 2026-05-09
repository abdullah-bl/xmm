import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const APP_NAME = Constants.expoConfig?.name ?? "the app";

/**
 * Checks for EAS Updates on cold start and when returning to foreground.
 * When an update is downloaded, schedules a local notification. The user
 * applies the update from Settings → Check for Updates (which calls
 * `Updates.reloadAsync`).
 */
export function useUpdatesCheck() {
  const busy = useRef(false);

  useEffect(() => {
    if (__DEV__) return;

    let cancelled = false;

    const run = async () => {
      if (busy.current || cancelled) return;
      if (!Updates.isEnabled) return;
      busy.current = true;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Update ready",
            body: `Restart ${APP_NAME} to load the latest version.`,
          },
          trigger: null,
        });
      } catch (e) {
        console.warn("[updates] check failed", e);
      } finally {
        busy.current = false;
      }
    };

    void run();

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void run();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
