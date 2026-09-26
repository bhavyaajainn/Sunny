import type { CSSProperties } from 'react';
import { ICON_NAMES, ICON_SVGS, type IconName } from '../../../shared/icons';

// Each icon as a self-contained SVG image. <img> renders identically in Safari and Chrome
// (no innerHTML, no percentage-height quirks).
const SRC = Object.fromEntries(
  ICON_NAMES.map((n) => [
    n,
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64">${ICON_SVGS[n]}</svg>`,
    )}`,
  ]),
) as Record<IconName, string>;

interface Props {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}

/** One of the 8 positive icons from the prototype. Decorative, so hidden from screen readers. */
export function Icon({ name, className, style }: Props) {
  return (
    <span className={className ? `ico ${className}` : 'ico'} style={style} aria-hidden="true">
      <img src={SRC[name]} alt="" draggable={false} />
    </span>
  );
}
