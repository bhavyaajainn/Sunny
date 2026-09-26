// App data + actions, backed by the /api Worker.
// Writes are optimistic: the UI changes immediately, then rolls back with an error toast
// if the server rejects the change or the phone is offline.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Affirmation, Settings } from '../../../shared/types';
import type { Vibe } from '../../../shared/vibes';
import type { IconName } from '../../../shared/icons';
import { useToast } from '../components/Toast';
import { ApiError, api, errorMessage } from './api';
import { readCache, writeCache } from './cache';
import { notifState, subscribePush, type NotifState } from '../lib/push';

export type { NotifState };
export type BootState =
  { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

export interface AffirmationInput {
  text: string;
  icon: IconName;
  /** Reminder time, 'HH:MM'. */
  time: string;
  days: string;
  vibe: Vibe;
}

export interface Store {
  boot: BootState;
  retryBoot(): void;
  settings: Settings;
  affirmations: Affirmation[];
  notif: NotifState;

  enableNotifications(): Promise<NotifState>;
  updateSettings(patch: Partial<Settings>): Promise<boolean>;
  addAffirmation(input: AffirmationInput): Promise<boolean>;
  updateAffirmation(
    id: number,
    patch: Partial<AffirmationInput & { active: boolean }>,
  ): Promise<boolean>;
  deleteAffirmation(id: number): Promise<boolean>;
  restoreAffirmation(id: number): Promise<boolean>;
  sendTest(): Promise<boolean>;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}

const DEFAULT_SETTINGS: Settings = {
  name: '',
  timezone: 'Asia/Kolkata',
  theme: 'system',
};

const STILL_SAVING = 'Still saving that one. Try again in a second.';

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();

  // Start from the cached snapshot (instant open, offline reading), then refresh.
  const [initial] = useState(readCache);
  const [boot, setBoot] = useState<BootState>(initial ? { kind: 'ready' } : { kind: 'loading' });
  const [bootNonce, setBootNonce] = useState(0);
  const [settings, setSettings] = useState<Settings>(initial?.settings ?? DEFAULT_SETTINGS);
  const [affirmations, setAffirmations] = useState<Affirmation[]>(initial?.affirmations ?? []);
  const [notif, setNotif] = useState<NotifState>(notifState);

  // Latest values for use inside async actions (synced after each commit).
  const latest = useRef({ settings, affirmations });
  useEffect(() => {
    latest.current = { settings, affirmations };
  }, [settings, affirmations]);

  // Where a deleted affirmation was, so Undo puts it back in the same spot.
  const deletedAt = useRef(new Map<number, number>());
  const tempId = useRef(-1);

  // Boot: load everything from the server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, a] = await Promise.all([
          api<Settings>('GET', '/settings'),
          api<Affirmation[]>('GET', '/affirmations'),
        ]);
        if (cancelled) return;
        setSettings(s);
        setAffirmations(a);
        setBoot({ kind: 'ready' });
      } catch (err) {
        if (cancelled) return;
        const offline = err instanceof ApiError && err.status === 0;
        if (initial) {
          toast(
            offline
              ? "You're offline. Showing your saved affirmations."
              : `Couldn't refresh: ${errorMessage(err)}`,
          );
        } else {
          setBoot({
            kind: 'error',
            message: offline
              ? "Couldn't reach Sunny. Check your internet connection, then tap Try again."
              : errorMessage(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootNonce, initial, toast]);

  const retryBoot = useCallback(() => {
    setBoot({ kind: 'loading' });
    setBootNonce((n) => n + 1);
  }, []);

  // Keep the offline snapshot fresh.
  useEffect(() => {
    if (boot.kind === 'ready') {
      writeCache({
        settings,
        affirmations: affirmations.filter((a) => a.id > 0),
      });
    }
  }, [boot.kind, settings, affirmations]);

  // Must be called straight from a tap: iOS only shows the prompt for a user gesture.
  const enableNotifications = useCallback(async (): Promise<NotifState> => {
    if (notifState() === 'unsupported') {
      setNotif('unsupported');
      return 'unsupported';
    }
    const perm = await Notification.requestPermission();
    setNotif(perm);
    if (perm === 'granted') {
      try {
        await subscribePush();
        toast("Notifications are on. You'll get your reminders on the lock screen.");
      } catch (err) {
        toast(
          `Notifications are allowed, but this phone couldn't be registered: ${errorMessage(err)}`,
        );
      }
    } else if (perm === 'denied') {
      toast('Notifications are off. Turn them on in iPhone Settings → Notifications → Sunny.');
    }
    return perm;
  }, [toast]);

  // Re-send this device's subscription on every launch (it can change), and refresh the
  // permission when coming back from iPhone Settings.
  useEffect(() => {
    if (notifState() === 'granted') {
      subscribePush().catch((err: unknown) => console.warn('Push re-subscribe failed', err));
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNotif(notifState());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // ---------- Optimistic helper ----------

  const attempt = useCallback(
    async (call: () => Promise<void>, rollback: () => void): Promise<boolean> => {
      try {
        await call();
        return true;
      } catch (err) {
        rollback();
        toast(errorMessage(err));
        return false;
      }
    },
    [toast],
  );

  // ---------- Settings ----------

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const prev = latest.current.settings;
      setSettings((s) => ({ ...s, ...patch }));
      return attempt(
        async () => setSettings(await api<Settings>('PATCH', '/settings', patch)),
        () => setSettings(prev),
      );
    },
    [attempt],
  );

  // ---------- Affirmations ----------

  const replaceAff = (id: number, next: Affirmation) =>
    setAffirmations((list) => list.map((a) => (a.id === id ? next : a)));

  const addAffirmation = useCallback(
    async (input: AffirmationInput) => {
      const id = tempId.current--;
      const minPos = Math.min(0, ...latest.current.affirmations.map((a) => a.position));
      setAffirmations((list) => [{ id, ...input, active: true, position: minPos - 1 }, ...list]);
      return attempt(
        async () => replaceAff(id, await api<Affirmation>('POST', '/affirmations', input)),
        () => setAffirmations((list) => list.filter((a) => a.id !== id)),
      );
    },
    [attempt],
  );

  const updateAffirmation = useCallback<Store['updateAffirmation']>(
    async (id, patch) => {
      const prev = latest.current.affirmations.find((a) => a.id === id);
      if (!prev) return false;
      if (id < 0) {
        toast(STILL_SAVING);
        return false;
      }
      replaceAff(id, { ...prev, ...patch });
      return attempt(
        async () => replaceAff(id, await api<Affirmation>('PATCH', `/affirmations/${id}`, patch)),
        () => replaceAff(id, prev),
      );
    },
    [attempt, toast],
  );

  const deleteAffirmation = useCallback(
    async (id: number) => {
      const list = latest.current.affirmations;
      const index = list.findIndex((a) => a.id === id);
      const item = list[index];
      if (!item) return false;
      if (id < 0) {
        toast(STILL_SAVING);
        return false;
      }
      deletedAt.current.set(id, index);
      setAffirmations((l) => l.filter((a) => a.id !== id));
      return attempt(
        () => api<undefined>('DELETE', `/affirmations/${id}`),
        () =>
          setAffirmations((l) => {
            const copy = l.filter((a) => a.id !== id);
            copy.splice(Math.min(index, copy.length), 0, item);
            return copy;
          }),
      );
    },
    [attempt, toast],
  );

  const restoreAffirmation = useCallback(
    async (id: number) => {
      try {
        const item = await api<Affirmation>('POST', `/affirmations/${id}/restore`);
        const index = deletedAt.current.get(id) ?? 0;
        deletedAt.current.delete(id);
        setAffirmations((l) => {
          const copy = l.filter((a) => a.id !== id);
          copy.splice(Math.min(index, copy.length), 0, item);
          return copy;
        });
        return true;
      } catch (err) {
        toast(errorMessage(err));
        return false;
      }
    },
    [toast],
  );

  // ---------- Push ----------

  const sendTest = useCallback(async () => {
    try {
      await api('POST', '/push/test');
      return true;
    } catch (err) {
      toast(errorMessage(err));
      return false;
    }
  }, [toast]);

  const store = useMemo<Store>(
    () => ({
      boot,
      retryBoot,
      settings,
      affirmations,
      notif,
      enableNotifications,
      updateSettings,
      addAffirmation,
      updateAffirmation,
      deleteAffirmation,
      restoreAffirmation,
      sendTest,
    }),
    [
      boot,
      retryBoot,
      settings,
      affirmations,
      notif,
      enableNotifications,
      updateSettings,
      addAffirmation,
      updateAffirmation,
      deleteAffirmation,
      restoreAffirmation,
      sendTest,
    ],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
