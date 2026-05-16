export type { FeedbackType } from './backend.types';

export interface FeedbackDeviceInfo {
  os: string;
  osVersion: string;
  model: string;
  brand?: string;
  manufacturer?: string;
  isDevice?: boolean;
  locale?: string;
}

export interface FeedbackAppInfo {
  name: string;
  version: string;
  buildNumber?: string;
  runtimeVersion?: string;
  channel?: string;
  updateId?: string;
}
