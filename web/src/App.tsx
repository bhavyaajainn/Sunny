import { useCallback, useState } from 'react';
import { TabBar, type Tab } from './components/TabBar';
import { Sun } from './components/bits';
import { useToast } from './components/Toast';
import type { PushData } from '../../shared/types';
import { useStore } from './data/store';
import type { DevScreen } from './lib/dev';
import { addFelt, readFelt } from './lib/felt';
import { makeSample } from './lib/sample';
import { useThemeAndVibe } from './lib/theme';
import { AffirmationsScreen } from './screens/Affirmations';
import { Banner, Moment } from './screens/Moment';
import { InstallScreen } from './screens/InstallGuide';
import { RemindersScreen } from './screens/Reminders';
import { SettingsScreen } from './screens/Settings';
import { TodayScreen } from './screens/Today';

type Page = 'install-guide' | null;

const TAB_SCREENS: readonly string[] = ['today', 'affs', 'reminders', 'settings'];

/** Waits for the first load, then shows the app. */
export function App({ dev }: { dev: DevScreen | null }) {
  const { boot, retryBoot, settings } = useStore();
  useThemeAndVibe(settings.theme, settings.vibe);

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
  const { settings, affirmations, reminders, notif } = store;
  const toast = useToast();

  const [tab, setTab] = useState<Tab>(dev && TAB_SCREENS.includes(dev) ? (dev as Tab) : 'today');
  const [page, setPage] = useState<Page>(dev === 'install' ? 'install-guide' : null);
  const [today, setToday] = useState<{ id: number | null; swap: number }>({ id: null, swap: 0 });
  const [felt, setFelt] = useState(readFelt);
  const [moment, setMoment] = useState<PushData | null>(() =>
    dev === 'moment' ? makeSample(settings, affirmations, reminders) : null,
  );
  const [banner, setBanner] = useState<{ key: number; data: PushData } | null>(() =>
    dev === 'banner' ? { key: 0, data: makeSample(settings, affirmations, reminders) } : null,
  );

  const goTab = useCallback((t: Tab) => {
    setPage(null);
    setTab(t);
  }, []);

  const sendTest = useCallback(async () => {
    if (notif !== 'granted') {
      toast('Turn on notifications first. Tap "Turn on" in Settings.');
      return;
    }
    if (await store.sendTest()) toast('Sent! Check your lock screen in a few seconds.');
  }, [notif, store, toast]);

  const showBanner = useCallback(() => {
    setBanner({ key: Date.now(), data: makeSample(settings, affirmations, reminders) });
  }, [settings, affirmations, reminders]);

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
            onOpenReminders={() => goTab('reminders')}
          />
        )}
        {tab === 'affs' && <AffirmationsScreen />}
        {tab === 'reminders' && (
          <RemindersScreen onSendTest={() => void sendTest()} onShowBanner={showBanner} />
        )}
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
      {moment && <Moment data={moment} onSaid={momentSaid} onLater={momentLater} />}
    </>
  );
}
