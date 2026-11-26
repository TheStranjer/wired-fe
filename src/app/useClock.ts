/**
 * The status line's clock (AGENTS.md "Windows, like IRC buffers": the status
 * line names the time). The value is `formatClock` of the moment of render,
 * and the hook re-renders its component at the start of every minute: one
 * timeout to the next minute boundary, re-armed after every tick and cleared
 * on unmount. The formatting itself belongs to src/i18n/format, in the language in use.
 */

import { useEffect, useState } from 'react';

import { formatClock } from '../i18n/format';
import { useLocale } from '../i18n/I18nProvider';
import type { ClockFormat } from '../lib/time';

/** Milliseconds from {@link now} until the start of the next minute. */
function msToNextMinute(now: Date): number {
  const next = new Date(now);
  next.setMinutes(now.getMinutes() + 1, 0, 0);
  return next.getTime() - now.getTime();
}

/**
 * The current time as {@link formatClock} renders it in {@link format} and the language in use, fresh
 * on every minute boundary. The moment itself is state: taken at mount and
 * re-taken at every tick, so no render reads the clock directly.
 */
export function useClock(format: ClockFormat): string {
  const locale = useLocale();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const arm = (): void => {
      timer = setTimeout(() => {
        setNow(new Date());
        arm();
      }, msToNextMinute(new Date()));
    };
    arm();
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return formatClock(locale, now, format);
}
