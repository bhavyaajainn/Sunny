import { useCallback, useEffect, useState } from 'react';
import { TabBar, type Tab } from './components/TabBar';
import { Sun } from './components/bits';
import { useToast } from './components/Toast';
import type { PushData } from '../../shared/types';
import { useStore } from './data/store';
import type { DevScreen } from './lib/dev';
import { addFelt, readFelt } from './lib/felt';
import { makeSample } from './lib/sample';
import { momentFromUrl, toPushData } from './lib/moment';
import { useTheme } from './lib/theme';
import { AffirmationsScreen } from './screens/Affirmations';
import { Banner, Moment } from './screens/Moment';
import { InstallScreen } from './screens/InstallGuide';
import { SettingsScreen } from './screens/Settings';
import { TodayScreen } from './screens/Today';

type Page = 'install-guide' | null;

const TAB_SCREENS: readonly string[] = ['today', 'affs', 'settings'];

/** Waits for the first load, then shows the app. */
export function App({ dev }: { dev: DevScreen | null }) {
  const { boot, retryBoot, settings } = useStore();
  useTheme(settings.theme);

  if (boot.kind === 'loading') {
    return (
      <section className="screen onb" aria-label="Loading Sunny" aria-busy="true">
        <div className="spacer" />
        <Sun kind="bigsun" />
        <div className="spacer" />
      </section>
    );
  }
  if (boot.kind === 'error') {
    return (
      <section className="screen onb" aria-labelledby="boot-err">
        <Sun kind="bigsun" />
        <h2 className="center" id="boot-err">
          Sunny can't load
        </h2>
        <p className="sub center">{boot.message}</p>
        <div className="spacer" />
        <button type="button" className="btn block" onClick={retryBoot}>
          Try again
        </button>
      </section>
    );
  }
  return <Shell dev={dev} />;
}

function Shell({ dev }: { dev: DevScreen | null }) {
  const store = useStore();
  const { settings, affirmations, notif } = store;
  const toast = useToast();

  const [tab, setTab] = useState<Tab>(dev && TAB_SCREENS.includes(dev) ? (dev as Tab) : 'today');
  const [page, setPage] = useState<Page>(dev === 'install' ? 'install-guide' : null);
  const [today, setToday] = useState<{ id: number | null; swap: number }>({ id: null, swap: 0 });
  const [felt, setFelt] = useState(readFelt);
  const [moment, setMoment] = useState<PushData | null>(() =>
    dev === 'moment'
      ? makeSample(settings, affirmations)
      : momentFromUrl(location.search, affirmations),
  );
  const [banner, setBanner] = useState<{ key: number; data: PushData } | null>(() =>
    dev === 'banner' ? { key: 0, data: makeSample(settings, affirmations) } : null,
  );

  const goTab = useCallback((t: Tab) => {
    setPage(null);
    setTab(t);
  }, []);

  // Launched from a notification: clean the URL so a reload doesn't reopen the Moment.
  useEffect(() => {
    if (new URLSearchParams(location.search).has('moment')) history.replaceState(null, '', '/');
  }, []);

  // Messages from the service worker: a reminder arrived while open, or a notification was tapped.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent<unknown>) => {
      const msg = e.data as { type?: unknown } | null;
      const data = toPushData(msg);
      if (!data || !msg) return;
      if (msg.type === 'reminder') setBanner({ key: Date.now(), data });
      else if (msg.type === 'open-moment') {
        setBanner(null);
        setMoment(data);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  const sendTest = useCallback(async () => {
    if (notif === 'unsupported') {
      toast(
        'Notifications need Sunny opened from its Home Screen icon. See Settings → Install guide.',
      );
      return;
    }
    if (notif !== 'granted') {
      toast('Turn on notifications first: Settings → Notifications → Turn on.');
      return;
    }
    if (await store.sendTest()) toast('Sent! Check your lock screen in a few seconds.');
  }, [notif, store, toast]);

  const hideBanner = useCallback(() => setBanner(null), []);

  const openMoment = useCallback((data: PushData) => {
    setBanner(null);
    setMoment(data);
  }, []);

  const momentSaid = useCallback(() => {
    const id = moment?.affirmationId ?? null;
    setFelt(addFelt());
    setMoment(null);
    setPage(null);
    setTab('today');
    setToday((t) => ({ id: id ?? t.id, swap: t.swap + 1 }));
    toast('That glow is yours 🌟');
  }, [moment, toast]);

  const momentLater = useCallback(() => setMoment(null), []);

  // ---- Main app ----
  let content;
  if (page === 'install-guide') {
    content = <InstallScreen onDone={() => setPage(null)} />;
  } else {
    content = (
      <>
        {tab === 'today' && (
          <TodayScreen
            currentId={today.id}
            swapKey={today.swap}
            onAnother={(id) => setToday((t) => ({ id, swap: t.swap + 1 }))}
            felt={felt}
            onFelt={() => setFelt(addFelt())}
            onOpenList={() => goTab('affs')}
          />
        )}
        {tab === 'affs' && <AffirmationsScreen />}
        {tab === 'settings' && (
          <SettingsScreen
            onSendTest={() => void sendTest()}
            onShowInstall={() => setPage('install-guide')}
          />
        )}
        <TabBar tab={tab} onChange={goTab} />
      </>
    );
  }

  return (
    <>
      {content}
      {banner && (
        <Banner
          key={banner.key}
          data={banner.data}
          onOpen={() => openMoment(banner.data)}
          onHide={hideBanner}
        />
      )}
      {moment && (
        <Moment
          data={moment}
          icon={affirmations.find((x) => x.id === moment.affirmationId)?.icon}
          onSaid={momentSaid}
          onLater={momentLater}
        />
      )}
    </>
  );
}
