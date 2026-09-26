import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../components/Icon';
import { AppIcon, Sun } from '../components/bits';
import { Rain, useBursts } from '../components/Effects';
import type { PushData } from '../../../shared/types';
import type { IconName } from '../../../shared/icons';
import { VIBES, type Vibe } from '../../../shared/vibes';

/** The gradient colors of a vibe as CSS variables. */
function vibeVars(v: Vibe): CSSProperties {
  const [m1, m2, m3] = VIBES[v].colors;
  return { '--m1': m1, '--m2': m2, '--m3': m3 } as CSSProperties;
}

/** Full-screen celebration shown after tapping a notification or the in-app banner. */
export function Moment({
  data,
  icon,
  onSaid,
  onLater,
}: {
  data: PushData;
  /** The affirmation's own icon, shown in the middle of the row. */
  icon?: IconName;
  onSaid: () => void;
  onLater: () => void;
}) {
  const vibe = VIBES[data.vibe];
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
      style={vibeVars(data.vibe)}
      ref={host}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Your affirmation"
    >
      <Rain icons={vibe.icons} />
      <Sun kind="msun" />
      <div className="mrow" aria-hidden="true">
        <Icon name={vibe.icons[0]} />
        {icon ? <Icon name={icon} className="mine" /> : <Icon name={vibe.icons[1]} />}
        <Icon name={vibe.icons[2]} />
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
    <button
      type="button"
      className="banner"
      style={vibeVars(data.vibe)}
      onClick={onOpen}
      aria-live="polite"
    >
      <AppIcon />
      <div className="b-body">
        <b>{data.title}</b>
        <p>{data.body}</p>
      </div>
      <span className="bar" aria-hidden="true" />
    </button>
  );
}
