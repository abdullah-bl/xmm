import { useCallback, useState } from 'react';

import client from '@/lib/client';
import { buildAppInfo, buildDeviceInfo } from '@/lib/device-info';
import type { FeedbackPayload, FeedbackType } from '@/types/feedback';

export interface SubmitFeedbackInput {
  content: string;
  /**
   * Either a canonical `FeedbackType` or, when set to `"other"`, the free-text
   * label the user typed. The hook forwards the resolved type as-is to the
   * backend, which only requires a string.
   */
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

    const payload: FeedbackPayload = {
      content: trimmed,
      type: resolvedType,
      device: buildDeviceInfo(),
      app: buildAppInfo(),
    };

    setBusy(true);
    setError(null);
    try {
      // The `feedback` collection is not part of the generated PocketBase
      // typings; cast to satisfy the typed client wrapper.
      await (client as unknown as {
        collection: (name: string) => {
          create: (data: unknown) => Promise<unknown>;
        };
      })
        .collection('feedback')
        .create(payload);
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
