/**
 * Tests for the Unicode emoji hook (WFE-265): nothing is loaded until a picker
 * wants it, the emojibase list then arrives adapted (the real data, so the
 * adapter and the package agree), and a hook mounted after it has arrived has
 * it at once. The list is module-level and outlives one test, so the tests
 * run in this order.
 */
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { useUnicodeEmojis } from './useUnicodeEmojis';

/** The hook's answer as text: `loading`, or how many emoji and whether 🔥 is among them. */
function Emojis(props: { readonly wanted: boolean }): JSX.Element {
  const emojis = useUnicodeEmojis(props.wanted);
  const fire = emojis?.find((emoji) => emoji.emoji === '🔥');
  return (
    <p>
      {emojis === null
        ? 'loading'
        : `${emojis.length > 1000 ? 'many' : 'few'} ${fire?.name ?? 'no fire'} ${fire?.group ?? ''}`}
    </p>
  );
}

describe(useUnicodeEmojis, () => {
  it('has nothing until it is wanted', () => {
    render(<Emojis wanted={false} />);

    expect(screen.getByText('loading')).toBeVisible();
  });

  it('brings in the emojibase list once for every picker that wants it', async () => {
    render(
      <>
        <Emojis wanted />
        <Emojis wanted />
      </>,
    );

    expect(screen.getAllByText('loading')).toHaveLength(2);

    await expect(
      screen.findAllByText('many fire travel', {}, { timeout: 10_000 }),
    ).resolves.toHaveLength(2);
  });

  it('has the list from the first render once it has arrived', () => {
    render(<Emojis wanted={false} />);

    expect(screen.getByText('many fire travel')).toBeVisible();
  });
});
