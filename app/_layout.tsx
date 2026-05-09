import '../global.css';

import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>

      <ThemeProvider value={DarkTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
            headerShadowVisible: false,
            contentStyle: { backgroundColor: '#000' },
          }}
        >
          {/* camera */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          {/* settings */}
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          {/* gallery */}
          <Stack.Screen name="gallery" options={{ title: 'Gallery' }} />
          {/* gallery details */}
          <Stack.Screen
            name="gallery/[id]"
            options={{ title: 'Gallery Details' }}
          />
          {/* films */}
          <Stack.Screen name="films" options={{ title: 'Films' }} />
          {/* film details */}
          <Stack.Screen name="films/[id]" options={{ title: 'Film Details' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>

  );
}
