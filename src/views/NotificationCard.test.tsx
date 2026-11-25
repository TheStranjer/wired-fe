/**
 * Tests for the card rendering of ./NotificationLine (decision 15, WFE-233),
 * one per kind family: a mention, reply or quote is a header line above the
 * post's own card; the favourite, boost, reaction, poll, update and status
 * kinds are one compact line with a dim excerpt; every other kind is a compact
 * line with the notification's sentence. The clicks, avatars and the lines
 * density are in ./NotificationCard.actions.test.
 */
import { type RenderResult, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NotificationLine } from './NotificationLine';
import type { AppState } from '../state/appState';
import { status } from '../test/fixtures';
import { lineText, note, renderLine as renderWith, seeded } from '../test/notificationCards';

/** Render the notification line over {@link state}. */
function renderLine(state: AppState): RenderResult {
  return renderWith(NotificationLine, state);
}

describe('notifications as cards', () => {
  it('puts a mention header over the full post card', () => {
    const { container } = renderLine(seeded(note('mention', status('a'))));

    expect(lineText(container)).toMatch(/^@@lain@wired\.example mentioned you/u);
    expect(screen.getByRole('article', { name: 'Post a0 by @lain@wired.example' })).toBeVisible();
  });

  it('calls a mention that answers a post a reply', () => {
    renderLine(seeded(note('mention', status('a', { in_reply_to_id: '41' }))));

    expect(screen.getByText(/replied to you/u)).toBeVisible();
    expect(screen.getByRole('article')).toBeVisible();
  });

  it('puts a quote header over the quoting post', () => {
    renderLine(seeded(note('quote', status('q'))));

    expect(screen.getByText(/quoted you/u)).toBeVisible();
    expect(screen.getByRole('article')).toBeVisible();
  });

  it('falls back to one compact line for a mention with no post', () => {
    renderLine(seeded(note('mention', null)));

    expect(screen.getByText(/mentioned you/u)).toBeVisible();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it.each([
    ['favourite', '★', 'favourited your post'],
    ['reblog', '⟳', 'boosted your post'],
    ['poll', '☰', 'a poll ended'],
    ['update', '✎', 'edited a post'],
    ['status', '●', 'posted'],
  ])('shows a %s as one compact line with glyph %s', (type, glyph, words) => {
    const { container } = renderLine(
      seeded(note(type, status('q', { content: '<p>present day, present time</p>' }))),
    );

    expect(lineText(container)).toContain(glyph);
    expect(lineText(container)).toContain(words);
    expect(lineText(container)).toContain('"present day, present time"');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('shows a reaction with its own emoji, or a plain glyph without one', () => {
    const post = status('q');
    const { container, unmount } = renderLine(seeded(note('reaction', post, { emoji: '🔥' })));

    expect(lineText(container)).toContain('🔥');
    expect(lineText(container)).toContain('reacted to your post');

    unmount();
    const bare = renderLine(seeded(note('reaction', post)));

    expect(lineText(bare.container)).toContain('☺');
  });

  it('shows a follow as a compact line with the sentence and no excerpt', () => {
    const { container } = renderLine(seeded(note('follow', null)));

    expect(lineText(container)).toContain('followed you');
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('shows a kind that names no actor as plain words', () => {
    const { container } = renderLine(seeded(note('severed_relationships', null)));

    expect(lineText(container)).toContain('a moderation action severed some of your follows');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
