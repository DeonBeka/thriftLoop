import { useFocusEffect } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
  type Dispatch,
  type SetStateAction,
} from 'react';

interface ApiState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  /** Pull-to-refresh: keeps current data on screen while reloading. */
  refresh: () => Promise<void>;
  /** Silent reload (no spinners). */
  reload: () => Promise<void>;
  setData: Dispatch<SetStateAction<T | undefined>>;
}

/**
 * Small data-fetching hook: loading / error / refresh state for one API call.
 * Pass `refetchOnFocus` to silently reload whenever the screen regains focus.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options: { enabled?: boolean; refetchOnFocus?: boolean } = {},
): ApiState<T> {
  const { enabled = true, refetchOnFocus = false } = options;
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const hasLoaded = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  const execute = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (!enabled) return;
      const id = ++requestId.current;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        const result = await run();
        if (id !== requestId.current) return;
        setData(result);
        setError(null);
        hasLoaded.current = true;
      } catch (err) {
        if (id !== requestId.current) return;
        // Silent reloads shouldn't replace good data with an error screen.
        if (mode !== 'silent' || !hasLoaded.current) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [run, enabled],
  );

  useEffect(() => {
    void execute('initial');
  }, [execute]);

  const skipFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (!refetchOnFocus) return;
      if (skipFirstFocus.current) {
        skipFirstFocus.current = false;
        return;
      }
      void execute('silent');
    }, [execute, refetchOnFocus]),
  );

  return {
    data,
    error,
    loading,
    refreshing,
    refresh: () => execute('refresh'),
    reload: () => execute(hasLoaded.current ? 'silent' : 'initial'),
    setData,
  };
}
