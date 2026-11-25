/**
 * Shared setup for the emoji picker's tests (WFE-265): the picker over four
 * Unicode emoji, one custom emoji and two reactions of the post (🔥 the
 * viewer's own, `:party:` somebody else's), with spies for what it reports.
 */
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { EmojiPicker } from './EmojiPicker';
import type { EmojiPickerProps } from './EmojiPicker';

const UNICODE: EmojiPickerProps['data']['unicode'] = [
  { emoji: '😀', name: 'grinning face', group: 'smileys', keywords: ['happy', 'smile'] },
  { emoji: '🔥', name: 'fire', group: 'objects', keywords: ['flame', 'hot'] },
  { emoji: '🚒', name: 'fire engine', group: 'travel', keywords: ['truck'] },
  { emoji: '🍕', name: 'pizza', group: 'food', keywords: [] },
];

/** What the picker reported. */
type Spies = {
  readonly onChoose: (emoji: string, remove: boolean) => void;
  readonly onClose: () => void;
};

/** Render the picker over {@link UNICODE}, one custom emoji and two reactions. */
export function renderPicker(overrides: Partial<EmojiPickerProps> = {}): Spies {
  const spies: Spies = {
    onChoose: vi.fn<(emoji: string, remove: boolean) => void>(),
    onClose: vi.fn<() => void>(),
  };
  render(
    <EmojiPicker
      data={{
        custom: [{ shortcode: 'blob', url: 'https://m.example/blob.png', category: null }],
        unicode: UNICODE,
      }}
      label="a4"
      reactions={[
        { name: '🔥', count: 2, me: true, url: null },
        { name: 'party', count: 1, me: false, url: 'https://m.example/party.png' },
      ]}
      {...spies}
      {...overrides}
    />,
  );
  return spies;
}

/** The search field. */
export function search(): HTMLElement {
  return screen.getByRole('searchbox', { name: 'Search emoji' });
}
