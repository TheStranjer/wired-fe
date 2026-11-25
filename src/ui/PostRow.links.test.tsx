/**
 * Tests for the links in a post row's body (WFE-156): a plain click on a link
 * is offered to `onContentLink`, which prevents the browser default when the
 * app opens the link itself; a modifier click or a middle click is offered too
 * (WFE-238) and places the window; a link the app declines, and the right
 * button, keep the browser behaviour.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostRow } from './PostRow';
import type { PostRowProps } from './PostRow';
import type { ClickModifiers } from '../lib/clickModifiers';

const CONTENT =
  '<p><a href="https://wired.example/tags/rust">#rust</a> ' +
  '<a href="https://other.example/page">elsewhere</a></p>';

/** Render one row over {@link CONTENT} with these two handlers. */
function renderLinks(onContentLink: PostRowProps['onContentLink']): () => void {
  const onSelect = vi.fn<() => void>();
  render(
    <PostRow
      author={{ handle: 'alice', fullHandle: '@alice@m.example', self: false }}
      autoExpand={false}
      boostedBy={null}
      clockFormat="24h"
      contentHtml={CONTENT}
      counts={{ replies: 0, boosts: 0, favourites: 0 }}
      date={new Date(2026, 0, 2, 23, 4)}
      edited={false}
      emojis={[]}
      label="a3"
      media={[]}
      mine={{ boosted: false, favourited: false, bookmarked: false }}
      onContentLink={onContentLink}
      onPop={vi.fn<() => void>()}
      onSelect={onSelect}
      onSelectAuthor={vi.fn<() => void>()}
      onToggleReveal={vi.fn<() => void>()}
      poll={null}
      quote={null}
      reactions={[]}
      replyTo={null}
      revealed={false}
      selected={false}
      sensitive={false}
      spoilerText=""
      via={null}
      visibility="public"
    />,
  );
  return onSelect;
}

describe('PostRow links in the body', () => {
  it('hands a clicked link to the app and prevents the browser default when it opens it', () => {
    const onContentLink = vi.fn<(href: string, click: ClickModifiers) => boolean>(() => true);
    const onSelect = renderLinks(onContentLink);

    const proceeded = fireEvent.click(screen.getByRole('link', { name: '#rust' }));

    expect(onContentLink).toHaveBeenCalledExactlyOnceWith(
      'https://wired.example/tags/rust',
      expect.objectContaining({ button: 0, ctrlKey: false, shiftKey: false }),
    );
    expect(proceeded).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the browser default and the new-tab target on a link the app does not open', () => {
    const onContentLink = vi.fn<(href: string, click: ClickModifiers) => boolean>(() => false);
    const onSelect = renderLinks(onContentLink);
    const link = screen.getByRole('link', { name: 'elsewhere' });

    const proceeded = fireEvent.click(link);

    expect(onContentLink).toHaveBeenCalledExactlyOnceWith(
      'https://other.example/page',
      expect.anything(),
    );
    expect(proceeded).toBe(true);
    expect(link).toHaveAttribute('target', '_blank');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }])(
    'hands a click with %j to the app with its modifiers and keeps the browser off it',
    (init) => {
      const onContentLink = vi.fn<(href: string, click: ClickModifiers) => boolean>(() => true);
      renderLinks(onContentLink);

      const proceeded = fireEvent.click(screen.getByRole('link', { name: '#rust' }), init);

      expect(onContentLink).toHaveBeenCalledExactlyOnceWith(
        'https://wired.example/tags/rust',
        expect.objectContaining(init),
      );
      expect(proceeded).toBe(false);
    },
  );

  it('hands a middle click to the app and keeps the browser from a new tab', () => {
    const onContentLink = vi.fn<(href: string, click: ClickModifiers) => boolean>(() => true);
    const onSelect = renderLinks(onContentLink);

    const proceeded = fireEvent(
      screen.getByRole('link', { name: '#rust' }),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
    );

    expect(onContentLink).toHaveBeenCalledExactlyOnceWith(
      'https://wired.example/tags/rust',
      expect.objectContaining({ button: 1 }),
    );
    expect(proceeded).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('leaves a middle click on a link the app does not open to the browser', () => {
    const onContentLink = vi.fn<(href: string, click: ClickModifiers) => boolean>(() => false);
    renderLinks(onContentLink);

    const proceeded = fireEvent(
      screen.getByRole('link', { name: 'elsewhere' }),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
    );

    expect(proceeded).toBe(true);
  });

  it('leaves the right button, and an auxiliary click off any link, alone', () => {
    const onContentLink = vi.fn<(href: string, click: ClickModifiers) => boolean>(() => true);
    const onSelect = renderLinks(onContentLink);

    const onLink = fireEvent(
      screen.getByRole('link', { name: '#rust' }),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 }),
    );
    const onRow = fireEvent(
      screen.getByRole('article'),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
    );

    expect(onLink).toBe(true);
    expect(onRow).toBe(true);
    expect(onContentLink).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
