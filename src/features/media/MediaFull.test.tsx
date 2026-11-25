/**
 * Tests for one attachment at full size (WFE-263): an image from its `url`
 * with the description as alt text and no referrer, a video that never
 * autoplays and a gifv that loops muted unless the reader asked for reduced
 * motion, an audio player, a link line for any other file, and a notice where
 * the attachment has no http(s) address.
 */
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaFull } from './MediaFull';
import type { MediaItem } from '../../ui/MediaList';

const URL = 'https://media.example/full/m1';

/** An attachment of {@link type}, its full file at {@link URL}. */
function item(type: MediaItem['type'], extras: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'm1',
    type,
    url: URL,
    previewUrl: 'https://media.example/small/m1',
    description: null,
    ...extras,
  };
}

describe(MediaFull, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws an image from its full url with its description as alt text', () => {
    const { getByRole } = render(<MediaFull item={item('image', { description: 'a wall' })} />);

    expect(getByRole('img', { name: 'a wall' })).toHaveAttribute('src', URL);
  });

  it('shows a video’s preview as its poster, and no poster without one', () => {
    const withPreview = render(<MediaFull item={item('video')} />);

    expect(withPreview.container.querySelector('video')?.getAttribute('poster')).toBe(
      'https://media.example/small/m1',
    );

    const without = render(<MediaFull item={item('video', { previewUrl: null })} />);

    expect(without.container.querySelector('video')?.hasAttribute('poster')).toBe(false);
  });

  it('plays a video from its url, never on its own', () => {
    const { container } = render(<MediaFull item={item('video')} />);
    const video = container.querySelector('video');

    expect(video?.getAttribute('src')).toBe(URL);
    expect(video?.autoplay).toBe(false);
    expect(video?.controls).toBe(true);
    expect(video?.loop).toBe(false);
    expect(video?.getAttribute('preload')).toBe('none');
  });

  it('loops a gifv muted once played', () => {
    const { container } = render(<MediaFull item={item('gifv')} />);
    const video = container.querySelector('video');

    expect(video?.loop).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.autoplay).toBe(false);
  });

  it('does not loop a gifv when the reader prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
    }));
    const { container } = render(<MediaFull item={item('gifv')} />);

    expect(container.querySelector('video')?.loop).toBe(false);
  });

  it('draws audio with controls that waits for the play button', () => {
    const { container } = render(<MediaFull item={item('audio')} />);
    const audio = container.querySelector('audio');

    expect(audio?.getAttribute('src')).toBe(URL);
    expect(audio?.autoplay).toBe(false);
  });

  it('links any other file, in a new tab without a referrer', () => {
    const { getByRole } = render(<MediaFull item={item('unknown')} />);
    const link = getByRole('link', { name: URL });

    expect(link).toHaveAttribute('href', URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('says there is no usable link where the attachment has no http(s) url', () => {
    const { getByText } = render(<MediaFull item={item('video', { url: null })} />);

    expect(getByText('[no usable link]')).toBeInTheDocument();
  });
});
