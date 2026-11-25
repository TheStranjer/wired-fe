/**
 * Tests for the media grid's cover: a sensitive post, or one whose body is
 * behind a content warning, loads nothing until the block is opened, and the
 * reader's auto-expand lifts the cover of a post that is not sensitive.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { item, renderGrid } from './mediaGridHarness';

const COVER = '[ SENSITIVE — show ]';

describe('MediaGrid cover', () => {
  it('hides a sensitive post behind a block and loads nothing', () => {
    const { container } = renderGrid(
      [item(), item({ id: 'v', type: 'video' }), item({ id: 'a', type: 'audio' })],
      { sensitive: true },
    );

    expect(screen.getByRole('button', { name: COVER })).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('video, audio, img')).toBeNull();
  });

  it('shows the media once the block is opened', () => {
    const { container } = renderGrid([item(), item({ id: 'v', type: 'video' })], {
      sensitive: true,
    });

    fireEvent.click(screen.getByRole('button', { name: COVER }));

    expect(screen.getByRole('img', { name: 'a wall' })).toBeInTheDocument();
    expect(container.querySelector('video')).not.toBeNull();
    expect(screen.queryByRole('button', { name: COVER })).toBeNull();
  });

  it('keeps a sensitive post covered even when the reader auto-expands media', () => {
    renderGrid([item()], { sensitive: true, autoExpand: true });

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: COVER })).toBeInTheDocument();
  });

  it('covers a post whose body is behind a content warning', () => {
    renderGrid([item()], { warned: true });

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: COVER })).toBeInTheDocument();
  });

  it('opens a warned, non-sensitive cover when the reader auto-expands media', () => {
    renderGrid([item()], { warned: true, autoExpand: true });

    expect(screen.getByRole('img', { name: 'a wall' })).toBeInTheDocument();
  });

  it('draws the grid, uncovered, for a post that is neither sensitive nor warned', () => {
    renderGrid([item()]);

    expect(screen.queryByRole('button', { name: COVER })).toBeNull();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
