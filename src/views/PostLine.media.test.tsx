/**
 * Tests for the attachment click of a post line (WFE-264): a plain click on
 * the nth image runs `/media <label> <n>` through the app's line runner, on a
 * card and on an IRC row, and a click with Ctrl held is left to the browser.
 * With no `/media` in the registry no click is intercepted.
 */
import { fireEvent, render, screen } from '@testing-library/react';
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
import { attachment, mediaPost } from '../test/mediaWindow';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const ACCOUNT_KEY = `${ORIGIN}#acct-1`;

const ACCOUNT: StoredAccount = {
  key: ACCOUNT_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT_KEY, target: null };
const HOME = windowId(REF);

/** The line the registry gives `/media` on the first post. */
const MEDIA_LINE = { line: '/media a0', prefill: false };

/** A post with two described images. */
const POST: Status = mediaPost([
  attachment('m1', 'image', { description: 'first wall' }),
  attachment('m2', 'image', { description: 'second wall' }),
]);

/** Render {@link POST} as the first line of the home window, as a card or a row. */
function renderPost(
  density: 'cards' | 'lines',
  lines: PostActions['linesFor'] = () => ({ media: MEDIA_LINE }),
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
  const seeded = appReducer(opened, {
    type: 'statuses',
    windowId: HOME,
    statuses: [POST],
    where: 'newer',
  });
  const state = appReducer(seeded, {
    type: 'windows',
    action: { type: 'setDisplay', id: HOME, overrides: { density } },
  });
  const run = vi.fn<PostActions['run']>();
  render(
    <AppStateProvider initial={state}>
      <PostActionsProvider actions={{ linesFor: lines, run }}>
        <PostLine lineKey={`post:${POST.id}`} status={POST} windowId={HOME} />
      </PostActionsProvider>
    </AppStateProvider>,
  );
  return run;
}

describe('the attachments of a post line', () => {
  it('runs /media with the label and the 1-based index on a click on the second image', () => {
    const run = renderPost('cards');

    const proceeded = fireEvent.click(screen.getByRole('img', { name: 'second wall' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/media a0 2', prefill: false });
    expect(proceeded).toBe(false);
  });

  it('leaves a Ctrl-click to the browser', () => {
    const run = renderPost('cards');

    const proceeded = fireEvent.click(screen.getByRole('img', { name: 'first wall' }), {
      ctrlKey: true,
    });

    expect(run).not.toHaveBeenCalled();
    expect(proceeded).toBe(true);
  });

  it('intercepts nothing when the registry has no /media', () => {
    const run = renderPost('cards', () => ({}));

    const proceeded = fireEvent.click(screen.getByRole('img', { name: 'first wall' }));

    expect(run).not.toHaveBeenCalled();
    expect(proceeded).toBe(true);
  });

  it('runs /media from the IRC rendering too', () => {
    const run = renderPost('lines');
    fireEvent.click(screen.getByRole('button', { name: /IMG 2\/2/u }));

    fireEvent.click(screen.getByRole('img', { name: 'second wall' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/media a0 2', prefill: false });
  });
});
