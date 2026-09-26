// Confetti burst (from a button) and falling rain (Moment screen). Both are skipped
// entirely under prefers-reduced-motion. Random values are generated outside render
// (in the click handler, or once when the rain mounts) so re-renders don't reshuffle them.
import { useCallback, useRef, useState, type CSSProperties } from 'react';
import type { IconName } from '../../../shared/icons';
import { prefersReducedMotion } from '../lib/motion';
import { Icon } from './Icon';

const BURST_COLORS = ['#FFD23F', '#FF6B2C', '#8FD3FF', '#FF7BAC', '#6CCB5F'];
const BURST_ICONS: IconName[] = ['sun', 'heart', 'star', 'flower', 'sprout'];

interface Particle {
  i: number;
  icon: IconName | null;
  style: CSSProperties;
}

function burstParticles(): Particle[] {
  return Array.from({ length: 24 }, (_, i) => {
    const style = {
      '--a': `${i * (360 / 24) + Math.random() * 10}deg`,
      '--d': `${70 + Math.random() * 100}px`,
    } as CSSProperties;
    if (i % 3 === 0) return { i, icon: BURST_ICONS[i % 5] ?? 'sun', style };
    return {
      i,
      icon: null,
      style: {
        ...style,
        background: BURST_COLORS[i % BURST_COLORS.length],
        borderRadius: i % 2 ? '50%' : undefined,
      },
    };
  });
}

function Particles({ parts }: { parts: Particle[] }) {
  return parts.map(({ i, icon, style }) =>
    icon ? <Icon key={i} name={icon} style={style} /> : <span key={i} style={style} />,
  );
}

/**
 * Returns [bursts, fire]. Render `bursts` inside a position:relative host, then call
 * fire(host, button) to burst from the button's center.
 */
export function useBursts() {
  const [items, setItems] = useState<
    Array<{ id: number; x: number; y: number; parts: Particle[] }>
  >([]);
  const seq = useRef(0);

  const fire = useCallback((host: HTMLElement | null, from: HTMLElement) => {
    if (!host || prefersReducedMotion()) return;
    const r = host.getBoundingClientRect();
    const b = from.getBoundingClientRect();
    const id = ++seq.current;
    const item = {
      id,
      x: b.left - r.left + b.width / 2,
      y: b.top - r.top + b.height / 2,
      parts: burstParticles(),
    };
    setItems((s) => [...s, item]);
    setTimeout(() => setItems((s) => s.filter((it) => it.id !== id)), 1000);
  }, []);

  const bursts = items.map((it) => (
    <div key={it.id} className="burst" style={{ left: it.x, top: it.y }} aria-hidden="true">
      <Particles parts={it.parts} />
    </div>
  ));
  return [bursts, fire] as const;
}

const RAIN_COLORS = ['#FFF6C8', '#FFD23F', '#8FD3FF', '#fff', '#FF7BAC'];

function rainDrops(icons: readonly IconName[]): Particle[] {
  const all: IconName[] = [...icons, 'heart', 'star'];
  return Array.from({ length: 44 }, (_, i) => {
    const style: CSSProperties = {
      left: `${Math.random() * 100}%`,
      animationDuration: `${2 + Math.random() * 1.8}s`,
      animationDelay: `${Math.random()}s`,
    };
    if (i % 3 === 0) return { i, icon: all[i % all.length] ?? 'sun', style };
    return {
      i,
      icon: null,
      style: {
        ...style,
        background: RAIN_COLORS[i % RAIN_COLORS.length],
        borderRadius: i % 2 ? '50%' : undefined,
      },
    };
  });
}

export function Rain({ icons }: { icons: readonly IconName[] }) {
  const [drops] = useState(() => (prefersReducedMotion() ? [] : rainDrops(icons)));
  if (!drops.length) return null;
  return (
    <div className="rain" aria-hidden="true">
      <Particles parts={drops} />
    </div>
  );
}
