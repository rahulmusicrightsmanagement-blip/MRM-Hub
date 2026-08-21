import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Pure: read tracked keys out of a URLSearchParams, falling back to defaults. */
export const readUrlState = (params, defaults) => {
  const out = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const raw = params.get(key);
    if (raw === null) { out[key] = fallback; continue; }
    out[key] = typeof fallback === 'number' ? (Number(raw) || fallback) : raw;
  }
  return out;
};

/** Pure: apply a patch, dropping anything that is empty or back at its default. */
export const writeUrlState = (prev, patch, defaults) => {
  const next = new URLSearchParams(prev);
  for (const [key, value] of Object.entries(patch)) {
    const isDefault = value === defaults[key];
    if (value === undefined || value === null || value === '' || isDefault) next.delete(key);
    else next.set(key, String(value));
  }
  return next;
};

/**
 * Keeps a page's view settings (filters, sort, page number) in the query
 * string, so any view someone is looking at is a shareable, bookmarkable link
 * and the browser Back button steps through it.
 *
 * Only ever touches its own keys — any other params on the URL, such as the
 * ?notifType/?notifId notification deep-links, are preserved untouched.
 *
 * A value equal to its default is removed from the URL rather than written,
 * so a clean view produces a clean address.
 *
 * @param {object} defaults  keys to track, with their default values. MUST be
 *                           a stable reference (declare it at module level).
 * @returns {[object, (patch: object) => void]}
 */
export const useUrlState = (defaults) => {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => readUrlState(params, defaults), [params, defaults]);

  const set = useCallback(
    (patch) => setParams((prev) => writeUrlState(prev, patch, defaults), { replace: true }),
    [setParams, defaults],
  );

  return [state, set];
};

export default useUrlState;
