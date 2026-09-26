import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Sun } from '../components/bits';
import { useBursts } from '../components/Effects';
import { timeIcon, type IconName } from '../../../shared/icons';
import { useStore } from '../data/store';
import { feltText } from '../lib/felt';
import { greeting, nextReminder } from '../lib/time';

const DOODLES: ReadonlyArray<[IconName, number, number, number]> = [
  ['cloud', 18, 26, 0],
  ['star', 78, 10, 0.5],
  ['heart', 128, 40, 1],
  ['flower', 66, 58, 1.5],
];

/** Re-render once a minute so the greeting and "Next reminder" stay current. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function TodayScreen({
  currentId,
  swapKey,
  onAnother,
  felt,
  onFelt,
  onOpenList,
}: {
  currentId: number | null;
  swapKey: number;
  onAnother: (id: number) => void;
  felt: number;
  onFelt: () => void;
  onOpenList: () => void;
}) {
  const { settings, affirmations } = useStore();
  const now = useNow();
  const card = useRef<HTMLDivElement>(null);
  const [bursts, fire] = useBursts();

  const list = affirmations.filter((a) => a.active);
  const current = list.find((a) => a.id === currentId) ?? list[0] ?? null;
  const next = nextReminder(affirmations, now);

  const another = () => {
    const others = list.filter((a) => a.id !== current?.id);
    const pick = others[Math.floor(Math.random() * others.length)];
    if (pick) onAnother(pick.id);
  };

  return (
    <section className="screen" aria-label="Today">
      <div className="row">
        <Icon name="sun" className="greet-ico" />
        <span className="greet">{greeting(now, settings.name)}</span>
      </div>

      <div className="suncard" ref={card}>
        <Sun kind="disc" />
        <div className="doodles" aria-hidden="true">
          {DOODLES.map(([n, x, y, d]) => (
            <Icon key={n} name={n} style={{ left: x, top: y, animationDelay: `${d}s` }} />
          ))}
        </div>
        <p key={swapKey} className={swapKey ? 'say swap' : 'say'} aria-live="polite">
          {current ? current.text : 'Add an affirmation to get started.'}
        </p>
        <div className="felt">{feltText(felt)}</div>
        <div className="acts">
          <button
            type="button"
            className="btn flame"
            onClick={(e) => {
              onFelt();
              fire(card.current, e.currentTarget);
            }}
          >
            I feel it ☀️
          </button>
          <button type="button" className="btn ghost" onClick={another} disabled={list.length < 2}>
            Another one
          </button>
        </div>
        {bursts}
      </div>

      <button type="button" className="nextrow" onClick={onOpenList}>
        <Icon name={next.affirmation?.time ? timeIcon(next.affirmation.time) : 'cloud'} />
        <span style={{ flex: 1 }}>
          <small>Next reminder</small>
          <span className="t">{next.text}</span>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    </section>
  );
}
