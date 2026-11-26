/**
 * Tests that the text of the controls of `src/ui` (A–M) goes through `t()`
 * (decision 19): under a fake language the divider, the command line and the
 * emoji picker, with its section titles and notes, read the fake catalog.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Divider } from './Divider';
import { EmojiPicker } from './EmojiPicker';
import type { EmojiPickerProps } from './EmojiPicker';
import { InputLine } from './InputLine';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale } from '../test/i18n';

/** Switch to the fake language, then show {@link ui} under the provider. */
function renderFake(ui: JSX.Element): void {
  installFakeLocale({
    ui: {
      divider: { resize: 'XX drag me' },
      emoji_picker: {
        dialog: 'XX react to [{label}]',
        search_label: 'XX find',
        search_placeholder: 'XX find…',
      },
      emoji_picker_model: {
        custom: 'XX loose',
        custom_category: 'XX custom: {category}',
        emoji: 'XX emoji',
        emoji_group: 'XX emoji: {group}',
        loading: 'XX loading',
        on_this_post: 'XX on the post',
      },
      emoji_section: { no_matches: 'XX nothing' },
      input_line: { label: 'XX command line' },
    },
  });
  render(<I18nProvider>{ui}</I18nProvider>);
}

/** A picker over a reaction, two custom emoji and one Unicode emoji, or {@link data}. */
function picker(data?: EmojiPickerProps['data']): JSX.Element {
  return (
    <EmojiPicker
      data={
        data ?? {
          custom: [
            { shortcode: 'blob', url: 'https://m.example/blob.png', category: 'Blobs' },
            { shortcode: 'plain', url: 'https://m.example/plain.png', category: null },
          ],
          unicode: [{ emoji: '😀', name: 'grinning face', group: 'smileys', keywords: [] }],
        }
      }
      label="a4"
      onChoose={vi.fn()}
      onClose={vi.fn()}
      reactions={[{ name: '🔥', count: 1, me: true, url: null }]}
    />
  );
}

/** The accessible names of the picker's sections, top to bottom. */
function sectionNames(): readonly (string | null)[] {
  return screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'));
}

describe('the controls of src/ui in another language', () => {
  it('words the divider’s name from the catalog', () => {
    renderFake(
      <Divider
        bounds={{ min: 0.1, max: 0.9 }}
        containerRef={{ current: null }}
        onRatioChange={vi.fn()}
        orientation="vertical"
        ratio={0.5}
      />,
    );

    expect(screen.getByRole('separator', { name: 'XX drag me' })).toBeInTheDocument();
  });

  it('words the command line’s name from the catalog', () => {
    renderFake(<InputLine onChange={vi.fn()} onSubmit={vi.fn()} prompt=">" value="" />);

    expect(screen.getByRole('combobox', { name: 'XX command line' })).toBeInTheDocument();
  });

  it('words the emoji picker and its section titles from the catalog', () => {
    renderFake(picker());

    expect(screen.getByRole('dialog', { name: 'XX react to [a4]' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'XX find' })).toHaveAttribute(
      'placeholder',
      'XX find…',
    );
    expect(sectionNames()).toStrictEqual([
      'XX on the post',
      'XX custom: Blobs',
      'XX loose',
      'XX emoji: smileys & emotion',
    ]);
  });

  it('words the note of Unicode emoji that are still loading from the catalog', () => {
    renderFake(picker({ custom: [], unicode: null }));

    expect(sectionNames()).toStrictEqual(['XX on the post', 'XX emoji']);
    expect(screen.getByText('XX loading')).toBeInTheDocument();
  });

  it('words the note of a search that found nothing from the catalog', () => {
    renderFake(picker());

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });

    expect(screen.getByText('XX nothing')).toBeInTheDocument();
  });
});
