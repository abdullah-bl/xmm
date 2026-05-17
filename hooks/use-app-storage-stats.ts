import { useCallback, useEffect, useState } from 'react';

import {
  type AppCacheStats,
  getAppCacheStats,
} from '@/lib/cache-cleanup';

export function useAppStorageStats() {
  const [stats, setStats] = useState<AppCacheStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getAppCacheStats();
      setStats(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, loading, refresh };
}
