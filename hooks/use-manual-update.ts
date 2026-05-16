import * as Updates from 'expo-updates';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

export function useManualUpdate() {
  const [checking, setChecking] = useState(false);

  const checkForUpdates = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) {
      Alert.alert(
        'Updates unavailable',
        'Over-the-air updates are only available in release builds installed from TestFlight or the App Store.',
      );
      return;
    }

    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        Alert.alert('Up to date', 'You already have the latest version.');
        return;
      }

      await Updates.fetchUpdateAsync();
      Alert.alert('Update ready', 'Restart the app to load the latest version.', [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Restart now',
          onPress: () => {
            Updates.reloadAsync().catch(() => { });
          },
        },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      Alert.alert('Could not check for updates', message);
    } finally {
      setChecking(false);
    }
  }, []);

  return { checking, checkForUpdates, updatesEnabled: Updates.isEnabled && !__DEV__ };
}
