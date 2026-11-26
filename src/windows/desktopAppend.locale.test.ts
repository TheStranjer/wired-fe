/**
 * Tests that the refusal to show or make a desktop follows the language in
 * use (WFE-316, decision 19): both sentences come from the catalog, the
 * second choosing its advice by whether the empty desktop is the active one.
 */
import { describe, expect, it } from 'vitest';

import { appendRefusal } from './desktopAppend';
import { EMPTY_DESKTOP } from './desktopPanes';
import { initialDesktops } from './desktops';
import { installFakeLocale } from '../test/i18n';

describe(appendRefusal, () => {
  it('says which desktops exist, in English first', () => {
    expect(appendRefusal(initialDesktops('w1'), 5)).toBe('No desktop 5; desktops run 1–1');
  });

  it('words the refusals from the catalog', () => {
    installFakeLocale({
      windows: {
        no_desktop: 'XX no {number} of {count}',
        desktop_empty: 'XX {count} empty, {last, select, yes {here} other {elsewhere}}',
      },
    });
    const one = initialDesktops('w1');
    const two = { ...one, desktops: [...one.desktops, EMPTY_DESKTOP] };

    expect(appendRefusal(one, 5)).toBe('XX no 5 of 1');
    expect(appendRefusal({ ...two, active: 1 }, 3)).toBe('XX 2 empty, here');
    expect(appendRefusal({ ...two, active: 0 }, 3)).toBe('XX 2 empty, elsewhere');
  });
});
