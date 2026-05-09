export type FeedbackType = 'bug' | 'suggestion' | 'praise' | 'other';

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

export interface FeedbackPayload {
  /** Free-form message body. */
  content: string;
  /**
   * Either one of the canonical `FeedbackType` values, or a custom label
   * provided by the user via the "Other" field.
   */
  type: FeedbackType | string;
  device: FeedbackDeviceInfo;
  app: FeedbackAppInfo;
}
