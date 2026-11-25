/**
 * Tests for the emoji picker of a post card (WFE-265): the `☺` button opens it
 * instead of filling the command line, the window's own account's custom emoji
 * (those that show in a picker) and the Unicode emoji are fetched only once it
 * opens, and a choice goes through the line runner as `/react <label> <emoji>`
 * — the character as it is, a custom one as `:shortcode:` — or as `/unreact`
 * for a reaction the viewer already made. With no `/react` there is no button.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { PostActionsProvider } from './PostActionsContext';
import type { PostActions } from './PostActionsContext';
import { PostLine } from './PostLine';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { status } from '../test/fixtures';
import { server } from '../test/server';
import type { PostActionLine } from '../ui/postActionTypes';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://picker.example';
const ACCOUNT_KEY = `${ORIGIN}#acct-1`;

const ACCOUNT: StoredAccount = {
  key: ACCOUNT_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@picker.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT_KEY, target: null };
const HOME = windowId(REF);

/** The line the registry gives `/react` on the first post. */
const REACT_LINE: PostActionLine = { line: '/react a0', prefill: false, picker: true };

/** Serve the instance's custom emoji, one of them hidden from pickers; count the asks. */
function serveEmojis(): () => number {
  let calls = 0;
  server.use(
    http.get(`${ORIGIN}/api/v1/custom_emojis`, () => {
      calls += 1;
      return HttpResponse.json([
        {
          shortcode: 'blob',
          url: `${ORIGIN}/blob.gif`,
          static_url: `${ORIGIN}/blob.png`,
          visible_in_picker: true,
          category: null,
        },
        { shortcode: 'secret', url: `${ORIGIN}/s.png`, visible_in_picker: false },
      ]);
    }),
  );
  return () => calls;
}

/** Render {@link post} as the first line of the home window; returns the runner's spy. */
function renderPost(
  post: Status,
  lines: PostActions['linesFor'] = () => ({ react: REACT_LINE }),
): Mock<PostActions['run']> {
  const signed = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT_KEY,
  });
  const opened = appReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
  const state = appReducer(opened, {
    type: 'statuses',
    windowId: HOME,
    statuses: [post],
    where: 'newer',
  });
  const run = vi.fn<PostActions['run']>();
  render(
    <AppStateProvider initial={state}>
      <PostActionsProvider actions={{ linesFor: lines, run }}>
        <PostLine lineKey={`post:${post.id}`} status={post} windowId={HOME} />
      </PostActionsProvider>
    </AppStateProvider>,
  );
  return run;
}

/** The `☺` button. */
function reactButton(): HTMLElement {
  return screen.getByRole('button', { name: 'React to post a0' });
}

describe('the emoji picker of a post card', () => {
  it('opens on a click instead of filling the line, and asks for the emoji only then', async () => {
    const calls = serveEmojis();
    const run = renderPost(status('p1'));

    expect(calls()).toBe(0);

    fireEvent.click(reactButton());

    expect(screen.getByRole('dialog', { name: 'React to [a0]' })).toBeVisible();

    await screen.findByRole('button', { name: ':blob:' });

    expect(screen.getByRole('button', { name: ':blob:' })).toBeVisible();
    expect(run).not.toHaveBeenCalled();
    expect(calls()).toBe(1);
  });

  it('offers the custom emoji that show in a picker as their still pictures', async () => {
    serveEmojis();
    renderPost(status('p2'));

    fireEvent.click(reactButton());

    await screen.findByRole('img', { name: ':blob:' });

    expect(screen.getByRole('img', { name: ':blob:' })).toHaveAttribute(
      'src',
      `${ORIGIN}/blob.png`,
    );
    expect(screen.queryByRole('button', { name: ':secret:' })).toBeNull();
  });

  it('runs /react with the Unicode character as it is', async () => {
    serveEmojis();
    const run = renderPost(status('p3'));
    fireEvent.click(reactButton());

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'fire' } });
    fireEvent.click(await screen.findByRole('button', { name: 'fire' }, { timeout: 10_000 }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/react a0 🔥', prefill: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('runs /react with a custom emoji as :shortcode:', async () => {
    serveEmojis();
    const run = renderPost(status('p4'));
    fireEvent.click(reactButton());

    fireEvent.click(await screen.findByRole('button', { name: ':blob:' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/react a0 :blob:', prefill: false });
  });

  it('runs /unreact for a reaction the viewer already made', () => {
    serveEmojis();
    const mine = status('p5', {
      pleroma: { emoji_reactions: [{ name: '🔥', count: 2, me: true, url: null }] },
    });
    const run = renderPost(mine);
    fireEvent.click(reactButton());

    fireEvent.click(screen.getByRole('button', { name: '🔥', pressed: true }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/unreact a0 🔥', prefill: false });
  });

  it('has no button when the registry has no /react', () => {
    renderPost(status('p6'), () => ({}));

    expect(screen.queryByRole('button', { name: 'React to post a0' })).toBeNull();
  });
});
