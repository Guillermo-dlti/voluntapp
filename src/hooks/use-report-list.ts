import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import type { ReportPage } from '@/services/reports';

const PAGE_SIZE = 50;

// Loads a report list 50 rows at a time. `fetchPage` must be memoized on the range: a new function
// starts over from the first page.
export function useReportList<T>(fetchPage: (offset: number, limit: number) => Promise<ReportPage<T>>) {
  const { refresh } = useAuth();
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Only the newest request may update the list, so a slow earlier page can't overwrite a reload.
  const latest = useRef(0);

  const load = useCallback(async (offset: number) => {
    const request = ++latest.current;
    if (offset > 0) setLoadingMore(true);
    try {
      const page = await fetchPage(offset, PAGE_SIZE);
      if (request !== latest.current) return;
      setRows((current) => (offset === 0 ? page.rows : [...current, ...page.rows]));
      setTotal(page.total);
      setMessage('');
      setState('ready');
    } catch (cause: unknown) {
      if (request !== latest.current) return;
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause));
      if (offset === 0) setState('error');
    } finally {
      if (request === latest.current) { setLoadingMore(false); setRefreshing(false); }
    }
  }, [fetchPage, refresh]);

  useEffect(() => { void load(0); }, [load]);

  return {
    rows, total, state, message, loadingMore, refreshing,
    reload: () => { setState('loading'); void load(0); },
    pullToRefresh: () => { setRefreshing(true); void load(0); },
    loadMore: () => { if (rows.length < total && !loadingMore && state === 'ready') void load(rows.length); },
  };
}
