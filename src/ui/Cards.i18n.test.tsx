/**
 * Tests that the words of the card parts of `src/ui` (A–M) go through `t()`
 * (decision 19): under a fake language the boost line, the DM strip of a card
 * head and the `you` of a direct message read the fake catalog.
 */
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { BoostLine } from './BoostLine';
import { bubbleName, dmStrip } from './cardDm';
import { CardHead } from './CardHead';
import type { DmStrip } from './CardHead';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale } from '../test/i18n';

/** Switch to the fake language, then show {@link ui} under the provider. */
function renderFake(ui: JSX.Element): void {
  installFakeLocale({
    ui: {
      boost_line: { boosted: 'XXboosted' },
      card_dm: { you: 'XXyou' },
      card_head: { dm_strip: 'XX DM {from}{count, plural, =0 {} other { to {to}}}' },
    },
  });
  render(<I18nProvider>{ui}</I18nProvider>);
}

/** A card head over {@link dm}. */
function head(dm: DmStrip): JSX.Element {
  return (
    <CardHead
      clockFormat="24h"
      date={new Date(2026, 0, 2, 23, 4)}
      dm={dm}
      label="a3"
      selected={false}
      via={null}
    />
  );
}

describe('the card parts of src/ui in another language', () => {
  it('words the boost line from the catalog', () => {
    renderFake(<BoostLine boostedBy={{ handle: 'bob', fullHandle: 'bob@m.example' }} />);

    expect(screen.getByText('XXboosted')).toBeInTheDocument();
  });

  it('words the DM strip of a message that names recipients from the catalog', () => {
    renderFake(head({ from: 'alice', to: ['bob', 'carol'] }));

    expect(screen.getByText('XX DM alice to bob, carol')).toBeInTheDocument();
  });

  it('words the DM strip of a message that names nobody else from the catalog', () => {
    renderFake(head({ from: 'alice', to: [] }));

    expect(screen.getByText('XX DM alice')).toBeInTheDocument();
  });

  it('calls the viewer by the catalog’s word in the strip and in a bubble', () => {
    installFakeLocale({ ui: { card_dm: { you: 'XXyou' } } });

    const strip = dmStrip({
      visibility: 'direct',
      author: { handle: 'alice', self: true },
      recipients: [{ handle: 'bob', self: false }],
      chat: null,
    });

    expect(strip).toStrictEqual({ from: 'XXyou', to: ['bob'] });
    expect(bubbleName({ own: true, collapsed: false }, 'Alice')).toBe('XXyou');
  });
});
