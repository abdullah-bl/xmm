import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from "@expo-google-fonts/rubik";
import * as Font from "expo-font";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Appearance, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";

import { useUpdatesCheck } from "@/hooks/useUpdatesCheck";
import "../global.css";

// Lock the app to dark mode at module scope so the very first render is
// already dark. Doing this in an effect causes a one-frame light flash on
// cold start, especially noticeable on the camera viewfinder.
Uniwind.setTheme("dark");
Appearance.setColorScheme("dark");

SplashScreen.preventAutoHideAsync().catch(() => { });

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

export default function AppLayout() {
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

  useUpdatesCheck();

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Slot />
    </GestureHandlerRootView>
  );
}
