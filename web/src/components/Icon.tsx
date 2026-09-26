import type { CSSProperties } from 'react';
import { ICON_SVGS, type IconName } from '../../../shared/icons';

interface Props {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}

/** One of the 8 positive icons from the prototype. Decorative, so hidden from screen readers. */
export function Icon({ name, className, style }: Props) {
  return (
    <span className={className ? `ico ${className}` : 'ico'} style={style} aria-hidden="true">
      {/* ICON_SVGS are fixed constants copied from the prototype, never user input. */}
      <svg viewBox="0 0 32 32" dangerouslySetInnerHTML={{ __html: ICON_SVGS[name] }} />
    </span>
  );
}
