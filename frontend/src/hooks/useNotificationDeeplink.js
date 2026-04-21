import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Reads ?notifType=...&notifId=... from URL and, once `isReady` is true,
 * finds the matching record in `records` and calls onOpen(record).
 * If no record matches (deleted / out of scope), calls onMissing(id, type).
 * Always clears the URL params after acting so the same notification can
 * be clicked again and re-opened.
 *
 * @param {object} opts
 * @param {string|string[]} opts.expectedType  type keyword(s) this page handles (e.g. 'lead', ['task', 'client'])
 * @param {Array}  opts.records                currently loaded records on the page
 * @param {(rec: object) => void} opts.onOpen  opens the modal with the record
 * @param {(id: string, type: string) => void} [opts.onMissing]  called when no match found
 * @param {boolean} [opts.isReady=true]        false while records are still loading
 * @param {boolean} [opts.enabled=true]
 */
export const useNotificationDeeplink = ({
  expectedType,
  records,
  onOpen,
  onMissing,
  isReady = true,
  enabled = true,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const lastNavRef = useRef('');

  useEffect(() => {
    if (!enabled || !isReady) return;
    const params = new URLSearchParams(location.search);
    const type = (params.get('notifType') || '').toLowerCase();
    const id = params.get('notifId');
    if (!id || !type) return;

    const types = Array.isArray(expectedType) ? expectedType : [expectedType];
    const typeMatches = types.some((t) => type.includes(String(t || '').toLowerCase()));
    if (!typeMatches) return;

    // Guard against duplicate fire from React StrictMode remount with the same URL
    const signature = `${type}:${id}:${location.key || ''}`;
    if (lastNavRef.current === signature) return;
    lastNavRef.current = signature;

    const rec = (records || []).find((r) => {
      const rid = r?._id?.toString?.() || r?.id?.toString?.();
      return rid === id;
    });

    const clean = new URLSearchParams(location.search);
    clean.delete('notifType');
    clean.delete('notifId');
    const qs = clean.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });

    if (rec) {
      onOpen(rec);
    } else if (typeof onMissing === 'function') {
      onMissing(id, type);
    }
  }, [location.search, location.key, location.pathname, records, isReady, enabled, expectedType, onOpen, onMissing, navigate]);
};
