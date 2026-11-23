import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounced autosave with ordered, never-overlapping saves.
 *
 * - markDirty(changes) merges changes into a pending batch and (re)starts the debounce timer.
 * - saveNow() flushes immediately (manual save) and resolves true on success.
 * - Failed batches are kept and merged under newer edits, so nothing is lost; status becomes 'error'.
 * - Pending changes are flushed when the component unmounts (e.g. navigating away).
 *
 * status: 'saved' | 'unsaved' | 'saving' | 'error'
 */
export function useAutosave({ onSave, delay = 1000 }) {
  const [status, setStatus] = useState('saved');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const pending = useRef({});
  const timer = useRef(null);
  const chain = useRef(Promise.resolve());
  const mounted = useRef(true);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const hasPending = () => Object.keys(pending.current).length > 0;

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;

    const run = async () => {
      if (!hasPending()) return true;
      const batch = pending.current;
      pending.current = {};
      if (mounted.current) setStatus('saving');
      try {
        await onSaveRef.current(batch);
        if (mounted.current) {
          setLastSavedAt(new Date());
          setStatus(hasPending() ? 'unsaved' : 'saved');
        }
        return true;
      } catch {
        pending.current = { ...batch, ...pending.current };
        if (mounted.current) setStatus('error');
        return false;
      }
    };

    // Serialize: each flush waits for the previous one so PUTs reach the server in order.
    const result = chain.current.then(run);
    chain.current = result.catch(() => false);
    return result;
  }, []);

  const markDirty = useCallback(
    (changes) => {
      pending.current = { ...pending.current, ...changes };
      setStatus('unsaved');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      if (hasPending()) flush();
    };
  }, [flush]);

  return { status, lastSavedAt, markDirty, saveNow: flush };
}
