/**
 * Tests for the media grid's players: a video waits for its play button, a
 * gifv loops muted but never autoplays (and does not loop under reduced
 * motion), audio waits too, an unknown file is a link line, and an attachment
 * with no usable address says so.
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PREVIEW_URL, item, renderGrid } from './mediaGridHarness';

const VIDEO = 'https://m.example/v.mp4';

describe('MediaGrid players', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws a video with controls, a poster and nothing preloaded', () => {
    const { container } = renderGrid([item({ type: 'video', url: VIDEO })]);

    const video = container.querySelector('video');

    expect(video).toHaveAttribute('src', VIDEO);
    expect(video).toHaveAttribute('poster', PREVIEW_URL);
    expect(video).toHaveAttribute('preload', 'none');
    expect(video).toHaveAttribute('controls');
  });

  it('never autoplays, loops or mutes a plain video', () => {
    const { container } = renderGrid([item({ type: 'video', url: VIDEO })]);

    const video = container.querySelector('video');

    expect(video).not.toHaveAttribute('autoplay');
    expect(video?.autoplay).toBe(false);
    expect(video?.loop).toBe(false);
    expect(video?.muted).toBe(false);
  });

  it('draws a video without a poster when it has no preview', () => {
    const { container } = renderGrid([item({ type: 'video', url: VIDEO, previewUrl: null })]);

    expect(container.querySelector('video')).not.toHaveAttribute('poster');
  });

  it('loops a gifv muted but never autoplays it', () => {
    const { container } = renderGrid([item({ type: 'gifv', url: VIDEO })]);

    const video = container.querySelector('video');

    expect(video?.loop).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.autoplay).toBe(false);
    expect(video).toHaveAttribute('preload', 'none');
  });

  it('does not loop a gifv when the reader prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
    }));
    const { container } = renderGrid([item({ type: 'gifv', url: VIDEO })]);

    expect(container.querySelector('video')?.loop).toBe(false);
  });

  it('draws audio with controls that waits for the play button', () => {
    const { container } = renderGrid([item({ type: 'audio', url: 'https://m.example/a.ogg' })]);

    const audio = container.querySelector('audio');

    expect(audio).toHaveAttribute('src', 'https://m.example/a.ogg');
    expect(audio).toHaveAttribute('preload', 'none');
    expect(audio).toHaveAttribute('controls');
    expect(audio?.autoplay).toBe(false);
  });

  it('draws an unknown file as a link line to it', () => {
    renderGrid([item({ type: 'unknown', url: 'https://m.example/f.mkv' })]);

    const link = screen.getByRole('link', { name: 'https://m.example/f.mkv' });

    expect(link).toHaveAttribute('href', 'https://m.example/f.mkv');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it.each(['video', 'gifv', 'audio', 'unknown'] as const)(
    'says so when a %s has no usable address',
    (type) => {
      renderGrid([item({ type, url: null })]);

      expect(screen.getByText('[no usable link]')).toBeInTheDocument();
    },
  );
});
