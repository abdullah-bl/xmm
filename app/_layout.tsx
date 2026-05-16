import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from "@expo-google-fonts/rubik";
import * as Sentry from '@sentry/react-native';
import * as Font from "expo-font";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Appearance, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";

import { useUpdatesCheck } from "@/hooks/useUpdatesCheck";
import { migrateLegacySandboxGallery } from "@/lib/sandbox-migration";
import "../global.css";

// Lock the app to dark mode at module scope so the very first render is
// already dark. Doing this in an effect causes a one-frame light flash on
// cold start, especially noticeable on the camera viewfinder.
Uniwind.setTheme("dark");
Appearance.setColorScheme("dark");

SplashScreen.preventAutoHideAsync().catch(() => { });

// Initialize Sentry at module scope so it runs before `Sentry.wrap` below.
// Calling init() inside a useEffect happens after the wrap, which causes
// the "App Start Span could not be finished" warning on cold start.
Sentry.init({
  dsn: 'https://ffb807911ece4d0d04ad9999c8b05039@o963140.ingest.us.sentry.io/4511398235537408',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  enableLogs: true,

  // Session Replay disabled to work around a sentry-cocoa main-thread
  // mutex hang in SentrySessionReplay.takeScreenshot that was causing
  // iOS watchdog terminations (App Hang Fully Blocked >= 2000 ms).
  // Re-enable after bumping @sentry/react-native and shipping a native build.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  integrations: [],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

const RUBIK_REGULAR = "Rubik_400Regular";

// Apply Rubik as the default font for every <Text /> in the app without
// touching each call site. setStyle merges with caller-provided styles, so
// individual fontWeight overrides still win.
const TextWithDefaults = Text as unknown as {
  defaultProps?: { style?: unknown };
};
TextWithDefaults.defaultProps = TextWithDefaults.defaultProps ?? {};
TextWithDefaults.defaultProps.style = [
  { fontFamily: RUBIK_REGULAR },
  TextWithDefaults.defaultProps.style,
];

export default Sentry.wrap(function AppLayout() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Font.loadAsync({
      Rubik_400Regular,
      Rubik_500Medium,
      Rubik_600SemiBold,
      Rubik_700Bold,
    })
      .catch((err) => console.warn("[fonts] load failed", err))
      .finally(() => {
        if (!cancelled) setFontsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fontsReady) return;
    SplashScreen.hideAsync().catch(() => { });
  }, [fontsReady]);

  useEffect(() => {
    // Best-effort: import any photos written by the previous sandbox gallery
    // into the system photo library. Runs at most once per install.
    migrateLegacySandboxGallery().catch(() => { });
  }, []);

  useUpdatesCheck();

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Slot />
    </GestureHandlerRootView>
  );
});
