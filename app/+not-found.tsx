import { Link, Stack } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function NotFoundScreen() {
	return (
		<>
			<Stack.Screen options={{ title: "" }} />
			<View className="flex-1 gap-4 px-8 pb-safe bg-background">
				<View className="flex-1 justify-end">
					<Text className="font-extrabold text-6xl text-foreground">404</Text>
					<Text className="text-foreground/50">This page does not exist.</Text>
				</View>
				<Link href="/" asChild>
					<Pressable className="w-full bg-foreground rounded-2xl py-4 items-center mb-20">
						<Text className="text-background font-semibold text-lg">Go Home</Text>
					</Pressable>
				</Link>
			</View>
		</>
	);
}
