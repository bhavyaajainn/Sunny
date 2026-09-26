import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../components/Icon';
import { AppIcon, Sun } from '../components/bits';
import { Rain, useBursts } from '../components/Effects';
import type { PushData } from '../../../shared/types';
import { VIBES } from '../../../shared/vibes';
import { useStore } from '../data/store';

/** Full-screen celebration shown after tapping a notification or the in-app banner. */
export function Moment({
  data,
  onSaid,
  onLater,
}: {
  data: PushData;
  onSaid: () => void;
  onLater: () => void;
}) {
  const { settings } = useStore();
  const vibe = VIBES[settings.vibe];
  const host = useRef<HTMLDivElement>(null);
  const [bursts, fire] = useBursts();
  const [done, setDone] = useState(false);

  // Move focus into the dialog (for screen readers) without drawing a focus ring on a button.
  useEffect(() => {
    host.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onSaid, 750);
    return () => clearTimeout(t);
  }, [done, onSaid]);

  const words = data.body.split(/\s+/).filter(Boolean);

  return (
    <div
      className="moment"
      ref={host}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Your affirmation"
    >
      <Rain icons={vibe.icons} />
      <Sun kind="msun" />
      <div className="mrow" aria-hidden="true">
        {vibe.icons.map((n, i) => (
          <Icon key={i} name={n} />
        ))}
      </div>
      <p className="mtitle">{data.title}</p>
      <p className="mwords" aria-label={data.body}>
        {words.map((w, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            <span aria-hidden="true" style={{ '--i': i } as CSSProperties}>
              {w}
            </span>
          </Fragment>
        ))}
      </p>
      <button
        type="button"
        className="btn block"
        disabled={done}
        onClick={(e) => {
          fire(host.current, e.currentTarget);
          setDone(true);
        }}
      >
        I said it out loud 🎉
      </button>
      <button type="button" className="link" onClick={onLater}>
        Later
      </button>
      {bursts}
    </div>
  );
}

/** Drops in when a reminder fires while Sunny is open. Auto-hides after 6s. */
export function Banner({
  data,
  onOpen,
  onHide,
}: {
  data: PushData;
  onOpen: () => void;
  onHide: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onHide, 6000);
    return () => clearTimeout(t);
  }, [onHide]);

  return (
    <button type="button" className="banner" onClick={onOpen} aria-live="polite">
      <AppIcon />
      <div className="b-body">
        <b>{data.title}</b>
        <p>{data.body}</p>
      </div>
      <span className="bar" aria-hidden="true" />
    </button>
  );
}
