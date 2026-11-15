/**
 * Tests for the media list: nothing printed without attachments, the one
 * placeholder line each kind earns with its index in the post, the no-
 * description words, what an opened image, video, audio and unknown file
 * become and where their links point, the sensitive mark that never opens by
 * itself, the reader's auto-expand, and the per-line open state.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MediaList } from './MediaList';
import type { MediaItem } from './MediaList';

const URL = 'https://m.example/media/full.png';
const PREVIEW = 'https://m.example/media/small.png';

/** One image attachment, overridden by {@link overrides}. */
function item(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'm1',
    type: 'image',
    url: URL,
    previewUrl: PREVIEW,
    description: 'a wall',
    ...overrides,
  };
}

/** The five kinds in list order, each described by its type. */
function oneOfEachKind(): readonly MediaItem[] {
  return (['image', 'gifv', 'video', 'audio', 'unknown'] as const).map((type, index) =>
    item({ id: `m${String(index)}`, type, description: type }),
  );
}

/** Render the list over {@link items}, closed unless asked otherwise. */
function renderList(
  items: readonly MediaItem[],
  options: { sensitive?: boolean; autoExpand?: boolean } = {},
) {
  return render(
    <MediaList
      autoExpand={options.autoExpand ?? false}
      items={items}
      sensitive={options.sensitive ?? false}
    />,
  );
}

describe(MediaList, () => {
  it('renders nothing when the post carries no attachment', () => {
    const { container } = renderList([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('labels each kind with its index in the post', () => {
    renderList(oneOfEachKind());

    const names = screen.getAllByRole('button').map((button) => button.textContent);

    expect(names).toStrictEqual([
      '[IMG 1/5: image]',
      '[GIF 2/5: gifv]',
      '[VID 3/5: video]',
      '[AUD 4/5: audio]',
      '[FILE 5/5: unknown]',
    ]);
  });

  it('says no description for an undescribed attachment', () => {
    renderList([item({ description: null })]);

    expect(screen.getByRole('button', { name: '[IMG 1/1: no description]' })).toBeInTheDocument();
  });

  it('opens an image as its preview, described by its alt text, linked to the file', () => {
    const { container } = renderList([item()]);
    const toggle = screen.getByRole('button', { name: '[IMG 1/1: a wall]' });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('img', { name: 'a wall' })).toHaveAttribute('src', PREVIEW);
    expect(container.querySelector('video')).toBeNull();
  });

  it('links the opened image to the full file, without an opener handle', () => {
    renderList([item()]);

    fireEvent.click(screen.getByRole('button', { name: '[IMG 1/1: a wall]' }));

    const link = screen.getByRole('link', { name: 'a wall' });

    expect(link).toHaveAttribute('href', URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('falls back to the file itself when there is no preview', () => {
    renderList([item({ previewUrl: null })]);

    fireEvent.click(screen.getByRole('button', { name: '[IMG 1/1: a wall]' }));

    expect(screen.getByRole('img', { name: 'a wall' })).toHaveAttribute('src', URL);
  });

  it('gives an undescribed image empty alt text', () => {
    const { container } = renderList([item({ description: null })]);

    fireEvent.click(screen.getByRole('button', { name: '[IMG 1/1: no description]' }));

    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('opens video as a player that preloads nothing', () => {
    const { container } = renderList(oneOfEachKind());

    fireEvent.click(screen.getByRole('button', { name: '[VID 3/5: video]' }));

    const video = container.querySelector('video');

    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('src', URL);
    expect(video).toHaveAttribute('preload', 'none');
    expect(video).toHaveAttribute('controls');
  });

  it('opens audio as a player that preloads nothing', () => {
    const { container } = renderList(oneOfEachKind());

    fireEvent.click(screen.getByRole('button', { name: '[AUD 4/5: audio]' }));

    const audio = container.querySelector('audio');

    expect(audio).not.toBeNull();
    expect(audio).toHaveAttribute('src', URL);
    expect(audio).toHaveAttribute('preload', 'none');
    expect(audio).toHaveAttribute('controls');
  });

  it('opens an unknown file as a plain link to it', () => {
    const { container } = renderList([
      item({ type: 'unknown', url: 'https://m.example/notes.txt' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: '[FILE 1/1: a wall]' }));

    const link = screen.getByRole('link', { name: 'https://m.example/notes.txt' });

    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.querySelector('img')).toBeNull();
  });

  it('closes a line again when its placeholder is pressed a second time', () => {
    renderList([item()], { autoExpand: true });
    const toggle = screen.getByRole('button', { name: '[IMG 1/1: a wall]' });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('opens only the line it pressed', () => {
    renderList([item(), item({ id: 'm2', description: 'the lounge' })]);

    fireEvent.click(screen.getByRole('button', { name: '[IMG 2/2: the lounge]' }));

    expect(screen.getByRole('img', { name: 'the lounge' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'a wall' })).toBeNull();
  });

  it('starts with every line open when the reader auto-expands media', () => {
    renderList(oneOfEachKind(), { autoExpand: true });

    expect(screen.getByRole('button', { name: '[IMG 1/5: image]' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: 'image' })).toBeInTheDocument();
  });

  it('marks every line of a sensitive post and opens none of them by itself', () => {
    renderList(oneOfEachKind(), { sensitive: true, autoExpand: true });

    const first = screen.getByRole('button', { name: '[SENSITIVE] [IMG 1/5: image]' });

    expect(screen.queryByRole('img')).toBeNull();
    expect(first).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(first);

    expect(screen.getByRole('img', { name: 'image' })).toBeInTheDocument();
  });

  it('marks a sensitive post without auto-expand the same way', () => {
    renderList([item()], { sensitive: true });

    expect(
      screen.getByRole('button', { name: '[SENSITIVE] [IMG 1/1: a wall]' }),
    ).toBeInTheDocument();
  });
});
