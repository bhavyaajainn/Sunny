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
import type { Affirmation, Reminder, Settings } from '../../../shared/types';
import type { IconName } from '../../../shared/icons';
import { useToast } from '../components/Toast';
import { ApiError, api, errorMessage } from './api';
import { readCache, writeCache } from './cache';

export type NotifState = NotificationPermission | 'unsupported';
export type BootState =
  { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

export interface AffirmationInput {
  text: string;
  icon: IconName;
}
export interface ReminderInput {
  time: string;
  label: string;
  days: string;
}

export interface Store {
  boot: BootState;
  retryBoot(): void;
  settings: Settings;
  affirmations: Affirmation[];
  reminders: Reminder[];
  notif: NotifState;

  enableNotifications(): Promise<NotifState>;
  updateSettings(patch: Partial<Settings>): Promise<boolean>;
  addAffirmation(input: AffirmationInput): Promise<boolean>;
  updateAffirmation(
    id: number,
    patch: Partial<Pick<Affirmation, 'text' | 'icon' | 'active'>>,
  ): Promise<boolean>;
  deleteAffirmation(id: number): Promise<boolean>;
  restoreAffirmation(id: number): Promise<boolean>;
  addReminder(input: ReminderInput): Promise<boolean>;
  updateReminder(id: number, patch: Partial<ReminderInput & { active: boolean }>): Promise<boolean>;
  deleteReminder(id: number): Promise<boolean>;
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
  vibe: 'sunny',
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
  const [reminders, setReminders] = useState<Reminder[]>(initial?.reminders ?? []);
  const [notif, setNotif] = useState<NotifState>('default');

  // Latest values for use inside async actions (synced after each commit).
  const latest = useRef({ settings, affirmations, reminders });
  useEffect(() => {
    latest.current = { settings, affirmations, reminders };
  }, [settings, affirmations, reminders]);

  // Where a deleted affirmation was, so Undo puts it back in the same spot.
  const deletedAt = useRef(new Map<number, number>());
  const tempId = useRef(-1);

  // Boot: load everything from the server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, a, r] = await Promise.all([
          api<Settings>('GET', '/settings'),
          api<Affirmation[]>('GET', '/affirmations'),
          api<Reminder[]>('GET', '/reminders'),
        ]);
        if (cancelled) return;
        setSettings(s);
        setAffirmations(a);
        setReminders(r);
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
        reminders: reminders.filter((r) => r.id > 0),
      });
    }
  }, [boot.kind, settings, affirmations, reminders]);

  const enableNotifications = useCallback(async (): Promise<NotifState> => {
    // Phase 4 replaces this with Notification.requestPermission() + push subscribe.
    setNotif('granted');
    return 'granted';
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

  // ---------- Reminders ----------

  const replaceRem = (id: number, next: Reminder) =>
    setReminders((list) => list.map((r) => (r.id === id ? next : r)));

  const addReminder = useCallback(
    async (input: ReminderInput) => {
      const id = tempId.current--;
      setReminders((list) => [...list, { id, ...input, active: true }]);
      return attempt(
        async () => replaceRem(id, await api<Reminder>('POST', '/reminders', input)),
        () => setReminders((list) => list.filter((r) => r.id !== id)),
      );
    },
    [attempt],
  );

  const updateReminder = useCallback<Store['updateReminder']>(
    async (id, patch) => {
      const prev = latest.current.reminders.find((r) => r.id === id);
      if (!prev) return false;
      if (id < 0) {
        toast(STILL_SAVING);
        return false;
      }
      replaceRem(id, { ...prev, ...patch });
      return attempt(
        async () => replaceRem(id, await api<Reminder>('PATCH', `/reminders/${id}`, patch)),
        () => replaceRem(id, prev),
      );
    },
    [attempt, toast],
  );

  const deleteReminder = useCallback(
    async (id: number) => {
      const prev = latest.current.reminders.find((r) => r.id === id);
      if (!prev) return false;
      if (id < 0) {
        toast(STILL_SAVING);
        return false;
      }
      setReminders((list) => list.filter((r) => r.id !== id));
      return attempt(
        () => api<undefined>('DELETE', `/reminders/${id}`),
        () => setReminders((list) => [...list, prev]),
      );
    },
    [attempt, toast],
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
      reminders,
      notif,
      enableNotifications,
      updateSettings,
      addAffirmation,
      updateAffirmation,
      deleteAffirmation,
      restoreAffirmation,
      addReminder,
      updateReminder,
      deleteReminder,
      sendTest,
    }),
    [
      boot,
      retryBoot,
      settings,
      affirmations,
      reminders,
      notif,
      enableNotifications,
      updateSettings,
      addAffirmation,
      updateAffirmation,
      deleteAffirmation,
      restoreAffirmation,
      addReminder,
      updateReminder,
      deleteReminder,
      sendTest,
    ],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
