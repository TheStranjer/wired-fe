/**
 * Tests that a post row takes its accessible name, reply marker, content
 * warning button and account marker from the language in use (decision 19).
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PostRow } from './PostRow';
import type { PostRowProps } from './PostRow';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale, resetFakeLocale } from '../test/i18n';

const PROPS: PostRowProps = {
  label: 'a3',
  date: new Date(2026, 0, 2, 23, 4),
  clockFormat: '24h',
  author: { handle: 'alice', fullHandle: '@alice@m.example', self: false },
  boostedBy: null,
  via: { label: 'me', full: '@me@x.example' },
  replyTo: 'a2',
  quote: null,
  contentHtml: '<p>present day</p>',
  emojis: [],
  spoilerText: 'spoilers',
  revealed: false,
  poll: null,
  media: [],
  sensitive: false,
  autoExpand: false,
  visibility: 'public',
  counts: { replies: 0, boosts: 0, favourites: 0 },
  mine: { boosted: false, favourited: false, bookmarked: false },
  reactions: [],
  edited: false,
  selected: false,
  onToggleReveal: vi.fn<() => void>(),
  onSelect: vi.fn<() => void>(),
  onSelectAuthor: vi.fn<() => void>(),
  onPop: vi.fn<() => void>(),
  onContentLink: () => false,
};

describe(PostRow, () => {
  afterEach(resetFakeLocale);

  it('words its name, reply marker, warning and account marker in the language in use', () => {
    installFakeLocale({
      ui: {
        post_article: { post: 'XX post {label} {handle}' },
        post_body: { content_warning: 'XX cw {text}' },
        post_row_head: { reply_to: 'XX re {label}:' },
        via_mark: { label: 'XX via {accounts}' },
      },
    });
    render(
      <I18nProvider>
        <PostRow {...PROPS} />
      </I18nProvider>,
    );

    expect(screen.getByRole('article', { name: 'XX post a3 @alice@m.example' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'XX cw spoilers' })).toBeVisible();
    expect(screen.getByText('XX re a2:')).toBeVisible();
    expect(screen.getByRole('note', { name: 'XX via @me@x.example' })).toBeVisible();
  });
});
