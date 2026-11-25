/**
 * Tests for the emoji picker (WFE-265): it opens with focus in the search
 * field, shows the post's reactions, the custom emoji and the Unicode emoji in
 * sections, narrows them as you type, closes on Escape, names a custom emoji
 * `:blob:` and shows a reaction of the viewer's own as pressed. The keys that
 * walk the grid are in ./EmojiPicker.keys.test.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmojiPicker } from './EmojiPicker';
import { renderPicker, search } from './emojiPickerHarness';

describe(EmojiPicker, () => {
  it('is a dialog named by the post, with focus in the search field', () => {
    renderPicker();

    expect(screen.getByRole('dialog', { name: 'React to [a4]' })).toBeVisible();
    expect(search()).toHaveFocus();
  });

  it('shows the post’s reactions, the custom emoji and the Unicode emoji in sections', () => {
    renderPicker();

    expect(
      screen.getAllByRole('region').map((region) => region.getAttribute('aria-label')),
    ).toStrictEqual([
      'on this post',
      'custom',
      'emoji: smileys & emotion',
      'emoji: food & drink',
      'emoji: travel & places',
      'emoji: objects',
    ]);
    expect(screen.getByRole('button', { name: 'pizza' })).toHaveTextContent('🍕');
  });

  it('names a custom emoji :blob: and draws its picture', () => {
    renderPicker();

    expect(screen.getByRole('button', { name: ':blob:' })).toBeVisible();
    expect(screen.getByRole('img', { name: ':blob:' })).toHaveAttribute(
      'src',
      'https://m.example/blob.png',
    );
  });

  it('shows a reaction of the viewer’s own pressed, and the others not', () => {
    renderPicker();

    expect(screen.getByRole('button', { name: '🔥', pressed: true })).toBeVisible();
    expect(screen.getByRole('button', { name: ':party:', pressed: false })).toBeVisible();
  });

  it('narrows the list as you type', () => {
    renderPicker();

    fireEvent.change(search(), { target: { value: 'fire' } });

    expect(screen.getByRole('button', { name: 'fire' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'fire engine' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'pizza' })).toBeNull();
    expect(screen.queryByRole('button', { name: ':blob:' })).toBeNull();
  });

  it('finds an emoji by its keywords too, the post’s own reaction with it', () => {
    renderPicker();

    fireEvent.change(search(), { target: { value: 'hot' } });

    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toStrictEqual(['🔥', 'fire']);
  });

  it('says so when nothing matches', () => {
    renderPicker();

    fireEvent.change(search(), { target: { value: 'zzzz' } });

    expect(screen.getByText('no matches')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a dim loading note until the Unicode emoji arrive', () => {
    renderPicker({ data: { custom: [], unicode: null } });

    expect(screen.getByText('loading…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'pizza' })).toBeNull();
  });

  it('chooses with a click, reporting whether it takes a reaction back', () => {
    const spies = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: 'pizza' }));
    fireEvent.click(screen.getByRole('button', { name: '🔥', pressed: true }));
    fireEvent.click(screen.getByRole('button', { name: ':blob:' }));
    fireEvent.click(screen.getByRole('button', { name: ':party:' }));

    expect(vi.mocked(spies.onChoose).mock.calls).toStrictEqual([
      ['🍕', false],
      ['🔥', true],
      [':blob:', false],
      [':party:', false],
    ]);
  });

  it('closes on Escape', () => {
    const spies = renderPicker();

    fireEvent.keyDown(search(), { key: 'Escape' });

    expect(spies.onClose).toHaveBeenCalledExactlyOnceWith();
  });

  it('keeps every key from the global hotkeys', () => {
    renderPicker();
    const reached = vi.fn<() => void>();
    document.addEventListener('keydown', reached);

    fireEvent.keyDown(search(), { key: 'j' });
    document.removeEventListener('keydown', reached);

    expect(reached).not.toHaveBeenCalled();
  });
});
