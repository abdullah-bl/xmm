import { useCallback, useState } from 'react';

import client from '@/lib/client';
import { buildAppInfo, buildDeviceInfo } from '@/lib/device-info';
import {
  Collections,
  type FeedbackCreate,
  type FeedbackType,
} from '@/types/backend.types';

export interface SubmitFeedbackInput {
  content: string;
  type: FeedbackType;
  customType?: string;
}

export interface UseFeedbackResult {
  submit: (input: SubmitFeedbackInput) => Promise<void>;
  busy: boolean;
  error: Error | null;
  reset: () => void;
}

export function useFeedback(): UseFeedbackResult {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reset = useCallback(() => setError(null), []);

  const submit = useCallback(async (input: SubmitFeedbackInput) => {
    if (busy) return;
    const trimmed = input.content.trim();
    if (!trimmed) {
      throw new Error('Please write your feedback before submitting.');
    }

    const resolvedType =
      input.type === 'other' && input.customType?.trim()
        ? input.customType.trim()
        : input.type;

    const payload = {
      content: trimmed,
      type: resolvedType,
      device: buildDeviceInfo(),
      app: buildAppInfo(),
    } satisfies FeedbackCreate;

    setBusy(true);
    setError(null);
    try {
      await client.collection(Collections.Feedbacks).create(payload);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { submit, busy, error, reset };
}
