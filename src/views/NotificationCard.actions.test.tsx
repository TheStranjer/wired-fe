/**
 * Tests for what a notification card does and shows around its words
 * (decision 15, WFE-233): the excerpt opens the post's thread, the actor's
 * handle opens their profile, `avatars` decides the picture, and the lines
 * density keeps the IRC line.
 */
import { fireEvent, type RenderResult, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NotificationLine } from './NotificationLine';
import type { AppState } from '../state/appState';
import { DEFAULT_SETTINGS } from '../state/settings';
import { status } from '../test/fixtures';
import { LINE_SETTINGS } from '../test/lineSettings';
import { lineText, note, renderLine as renderWith, seeded } from '../test/notificationCards';

/** Render the notification line of the window {@link id} over {@link state}. */
function renderLine(state: AppState, id?: string): RenderResult {
  return renderWith(NotificationLine, state, id);
}

describe('notification card actions', () => {
  it('opens the post thread when the excerpt is clicked', () => {
    renderLine(seeded(note('favourite', status('q', { content: '<p>look</p>' }))));

    fireEvent.click(screen.getByRole('button', { name: '"look"' }));

    expect(screen.getByRole('region', { name: 'windows' })).toHaveTextContent('thread/a0');
  });

  it('titles the thread by the post id when the window never labelled it', () => {
    renderLine(seeded(note('favourite', status('q'))), 'unknown-window');

    fireEvent.click(screen.getByRole('button', { name: '"q"' }));

    expect(screen.getByRole('region', { name: 'windows' })).toHaveTextContent('thread/q');
  });

  it('opens the actor profile when the handle is clicked', () => {
    renderLine(seeded(note('follow', null)));

    fireEvent.click(screen.getByRole('button', { name: '@lain@wired.example' }));

    expect(screen.getByRole('region', { name: 'windows' })).toHaveTextContent(
      '@lain@wired.example',
    );
  });

  it('shows the small avatar of the actor', () => {
    renderLine(seeded(note('follow', null)));

    expect(screen.getByRole('img', { name: 'Avatar of @lain@wired.example' })).toBeVisible();
  });

  it('leaves the picture out when the window shows no avatars', () => {
    renderLine(seeded(note('follow', null), { ...DEFAULT_SETTINGS, avatars: false }));

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('keeps the IRC line when the density is lines', () => {
    const { container } = renderLine(seeded(note('follow', null), LINE_SETTINGS));

    expect(lineText(container)).toMatch(/^\d\d:\d\d \*\*\* @lain@wired\.example followed you$/u);
    expect(screen.queryByRole('img')).toBeNull();
  });
});
