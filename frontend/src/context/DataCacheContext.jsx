import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';

const DataCacheContext = createContext(null);

const DEFAULT_TTL = 300_000;

export const DataCacheProvider = ({ children }) => {
  const cacheRef = useRef(new Map());
  const subsRef = useRef(new Map());

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

  return (
    <DataCacheContext.Provider value={{ getCached, setCached, invalidate, subscribe, fetchWithCache }}>
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const ctx = useContext(DataCacheContext);
  if (!ctx) throw new Error('useDataCache must be used within DataCacheProvider');
  return ctx;
};

export const useCachedFetch = (key, fetcher, { ttl = DEFAULT_TTL, enabled = true } = {}) => {
  const { getCached, subscribe, fetchWithCache } = useDataCache();
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState(() => getCached(key));
  const [loading, setLoading] = useState(() => getCached(key) === undefined);
  const [error, setError] = useState(null);

  useEffect(() => subscribe(key, (val) => setData(val)), [key, subscribe]);

  useEffect(() => {
    if (!enabled || !key) return;
    let alive = true;
    const cached = getCached(key);
    if (cached !== undefined) { setData(cached); setLoading(false); }
    else setLoading(true);

    fetchWithCache(key, () => fetcherRef.current(), { ttl })
      .then(() => { if (alive) setError(null); })
      .catch((err) => { if (alive) setError(err); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [key, enabled, ttl, fetchWithCache, getCached]);

  const refetch = useCallback(
    () => fetchWithCache(key, () => fetcherRef.current(), { ttl: 0, force: true }),
    [key, fetchWithCache]
  );

  return { data, loading, error, refetch };
};
