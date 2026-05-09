import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import { NativeModules, Platform } from 'react-native';

import type { FeedbackAppInfo, FeedbackDeviceInfo } from '@/types/feedback';

function detectLocale(): string | undefined {
  const settings = NativeModules?.SettingsManager;
  if (Platform.OS === 'ios') {
    return (
      settings?.settings?.AppleLocale ??
      settings?.settings?.AppleLanguages?.[0]
    );
  }
  if (Platform.OS === 'android') {
    return NativeModules?.I18nManager?.localeIdentifier;
  }
  return undefined;
}

export function buildDeviceInfo(): FeedbackDeviceInfo {
  return {
    os: Device.osName ?? Platform.OS,
    osVersion: Device.osVersion ?? String(Platform.Version),
    model: Device.modelName ?? Device.modelId ?? 'unknown',
    brand: Device.brand ?? undefined,
    manufacturer: Device.manufacturer ?? undefined,
    isDevice: Device.isDevice,
    locale: detectLocale(),
  };
}

export function buildAppInfo(): FeedbackAppInfo {
  const cfg = Constants.expoConfig;
  const buildNumber =
    Platform.OS === 'ios'
      ? cfg?.ios?.buildNumber
      : cfg?.android?.versionCode != null
        ? String(cfg.android.versionCode)
        : undefined;

  return {
    name: cfg?.name ?? 'app',
    version: cfg?.version ?? '0.0.0',
    buildNumber,
    runtimeVersion:
      typeof Updates.runtimeVersion === 'string'
        ? Updates.runtimeVersion
        : undefined,
    channel: Updates.channel ?? undefined,
    updateId: Updates.updateId ?? undefined,
  };
}
