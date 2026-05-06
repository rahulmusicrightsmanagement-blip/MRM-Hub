import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';

const DataCacheContext = createContext(null);

const DEFAULT_TTL = 300_000;

export const DataCacheProvider = ({ children }) => {
  const cacheRef = useRef(new Map());
  const subsRef = useRef(new Map());
  const fetchersRef = useRef(new Map());
  const autoRefreshTimerRef = useRef(null);

  const notify = (key, data) => {
    const s = subsRef.current.get(key);
    if (s) s.forEach((fn) => fn(data));
  };

  const getCached = useCallback((key) => {
    const e = cacheRef.current.get(key);
    return e ? e.data : undefined;
  }, []);

  const setCached = useCallback((key, data) => {
    cacheRef.current.set(key, { data, ts: Date.now() });
    notify(key, data);
  }, []);

  const invalidate = useCallback((key) => {
    if (key === undefined) { cacheRef.current.clear(); return; }
    cacheRef.current.delete(key);
  }, []);

  const subscribe = useCallback((key, fn) => {
    if (!subsRef.current.has(key)) subsRef.current.set(key, new Set());
    const s = subsRef.current.get(key);
    s.add(fn);
    return () => { s.delete(fn); if (s.size === 0) subsRef.current.delete(key); };
  }, []);

  const registerFetcher = useCallback((key, fetcher) => {
    const token = Symbol(key);
    const entry = fetchersRef.current.get(key) || { fetcher, tokens: new Set() };
    entry.fetcher = fetcher;
    entry.tokens.add(token);
    fetchersRef.current.set(key, entry);

    return () => {
      const current = fetchersRef.current.get(key);
      if (!current) return;
      current.tokens.delete(token);
      if (current.tokens.size === 0) fetchersRef.current.delete(key);
    };
  }, []);

  const fetchWithCache = useCallback(async (key, fetcher, { ttl = DEFAULT_TTL, force = false } = {}) => {
    const entry = cacheRef.current.get(key);
    if (!force && entry && entry.data !== undefined && (Date.now() - entry.ts) < ttl) {
      return entry.data;
    }
    if (entry?.inflight) return entry.inflight;

    const promise = (async () => {
      const data = await fetcher();
      cacheRef.current.set(key, { data, ts: Date.now() });
      notify(key, data);
      return data;
    })();

    const placeholder = entry || { data: undefined, ts: 0 };
    placeholder.inflight = promise;
    cacheRef.current.set(key, placeholder);

    try {
      return await promise;
    } finally {
      const e = cacheRef.current.get(key);
      if (e) delete e.inflight;
    }
  }, []);

  const refreshKey = useCallback((key) => {
    const entry = fetchersRef.current.get(key);
    if (!entry?.fetcher) return Promise.resolve(undefined);
    return fetchWithCache(key, entry.fetcher, { ttl: 0, force: true });
  }, [fetchWithCache]);

  const refreshActive = useCallback(() => {
    const keys = Array.from(fetchersRef.current.keys());
    keys.forEach((key) => {
      refreshKey(key).catch(() => undefined);
    });
  }, [refreshKey]);

  const scheduleRefreshActive = useCallback(() => {
    if (autoRefreshTimerRef.current) window.clearTimeout(autoRefreshTimerRef.current);
    autoRefreshTimerRef.current = window.setTimeout(() => {
      autoRefreshTimerRef.current = null;
      refreshActive();
    }, 150);
  }, [refreshActive]);

  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefreshActive();
    };

    window.addEventListener('focus', scheduleRefreshActive);
    window.addEventListener('mrm:data-mutated', scheduleRefreshActive);
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      if (autoRefreshTimerRef.current) window.clearTimeout(autoRefreshTimerRef.current);
      window.removeEventListener('focus', scheduleRefreshActive);
      window.removeEventListener('mrm:data-mutated', scheduleRefreshActive);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [scheduleRefreshActive]);

  return (
    <DataCacheContext.Provider value={{ getCached, setCached, invalidate, subscribe, fetchWithCache, registerFetcher, refreshKey, refreshActive }}>
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const ctx = useContext(DataCacheContext);
  if (!ctx) throw new Error('useDataCache must be used within DataCacheProvider');
  return ctx;
};

export const useCachedFetch = (key, fetcher, { ttl = DEFAULT_TTL, enabled = true, revalidateOnMount = true } = {}) => {
  const { getCached, subscribe, fetchWithCache, registerFetcher } = useDataCache();
  const fetcherRef = useRef(fetcher);

  const [data, setData] = useState(() => getCached(key));
  const [loading, setLoading] = useState(() => getCached(key) === undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    if (!key) return undefined;
    return subscribe(key, (val) => setData(val));
  }, [key, subscribe]);

  useEffect(() => {
    if (!enabled || !key) return undefined;
    return registerFetcher(key, () => fetcherRef.current());
  }, [key, enabled, registerFetcher]);

  useEffect(() => {
    if (!enabled || !key) return;
    let alive = true;
    const cached = getCached(key);
    if (cached !== undefined) { setData(cached); setLoading(false); }
    else setLoading(true);

    fetchWithCache(key, () => fetcherRef.current(), { ttl, force: revalidateOnMount })
      .then(() => { if (alive) setError(null); })
      .catch((err) => { if (alive) setError(err); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [key, enabled, ttl, revalidateOnMount, fetchWithCache, getCached]);

  const refetch = useCallback(
    () => fetchWithCache(key, () => fetcherRef.current(), { ttl: 0, force: true }),
    [key, fetchWithCache]
  );

  return { data, loading, error, refetch };
};
