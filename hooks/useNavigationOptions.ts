import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { Platform } from "react-native";

import { useThemeColor } from "./useThemeColor";

/**
 * Centralised stack screen options. The `standard` set is applied as
 * `screenOptions` on the root Stack so individual screens only need to
 * supply the props that diverge (title, headerLargeTitle, presentation).
 */
export const useNavigationOptions = () => {
	const foreground = useThemeColor("foreground");
	const background = useThemeColor("background");

	return useMemo(() => {
		const base: NativeStackNavigationOptions = {
			headerTintColor: foreground,
			headerTitleAlign: "center",
			headerShadowVisible: false,
			headerLargeTitleShadowVisible: false,
			headerLargeTitleStyle: {
				color: foreground,
				fontFamily: "Rubik_700Bold",
			},
			headerTitleStyle: {
				color: foreground,
				fontFamily: "Rubik_600SemiBold",
			},
			headerBackButtonDisplayMode: "minimal",
			contentStyle: { backgroundColor: background },
		};

		const platformHeader: NativeStackNavigationOptions = Platform.select({
			ios: { headerStyle: { backgroundColor: "transparent" } },
			default: { headerStyle: { backgroundColor: background } },
		});

		const standard: NativeStackNavigationOptions = {
			...base,
			...platformHeader,
			headerTransparent: Platform.OS === "ios",
		};

		return { base, standard };
	}, [foreground, background]);
};
