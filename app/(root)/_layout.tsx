import { Stack } from 'expo-router';

import { useNavigationOptions } from '@/hooks/useNavigationOptions';

export default function RootLayout() {
  const { standard } = useNavigationOptions();

  return (
    <Stack screenOptions={standard}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="gallery" />
      <Stack.Screen name="gallery/[id]" />
      <Stack.Screen name="films" />
      <Stack.Screen name="films/[id]" />
      <Stack.Screen
        name="settings/feedback"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [1.0],
        }}
      />
      <Stack.Screen name="settings/storage" />
      <Stack.Screen name="settings/privacy" />
      <Stack.Screen name="settings/terms" />
    </Stack>
  );
}
