/**
 * Tests for the media lines of the shared post view: the settings knob
 * `expandMedia` reaching the row as auto-expand, and the sensitive flag of a
 * status keeping its attachments closed anyway. The rest of what LineView
 * draws is in ./LineView and ./LineView.scroll.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LineView } from './LineView';
import type { StoredAccount } from '../accounts/accountStore';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import type { LineData } from '../state/buffer';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { AppStateProvider } from '../state/StateContext';
import { status } from '../test/fixtures';
import { LINE_SETTINGS } from '../test/lineSettings';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const ACCOUNT_KEY = `${ORIGIN}#acct-1`;

/** The one signed-in account the window belongs to. */
const ACCOUNT: StoredAccount = {
  key: ACCOUNT_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The home window on {@link ACCOUNT}, and the id its ref names. */
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT_KEY, target: null };
const HOME = windowId(REF);

/** One image attachment as the wire sends it, described and previewed. */
const ATTACHMENT = {
  id: 'm1',
  type: 'image',
  url: 'https://wired.example/media/m1.png',
  preview_url: 'https://wired.example/media/m1.small.png',
  description: 'a wall',
};

/** The signed-in state whose home buffer shows one post with one attachment. */
function withMedia(extras: Record<string, unknown> = {}): AppState {
  const signed = coreReducer(initialAppState(LINE_SETTINGS), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT_KEY,
  });
  const opened = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
  return appReducer(opened, {
    type: 'statuses',
    windowId: HOME,
    statuses: [status('pic', { media_attachments: [ATTACHMENT], ...extras })],
    where: 'newer',
  });
}

/** The home buffer's post line; the setup fails without one. */
function postLine(state: AppState): LineData {
  const line = bufferFor(state, HOME).lines.find((entry) => entry.kind === 'post');
  if (line === undefined) {
    throw new Error('the home buffer holds no post line');
  }
  return line;
}

/** Render the post line of {@link state}. */
function renderPostLine(state: AppState): void {
  render(
    <AppStateProvider initial={state}>
      <LineView line={postLine(state)} windowId={HOME} />
    </AppStateProvider>,
  );
}

describe('LineView media lines', () => {
  it('prints the attachment of a post as one closed placeholder line', () => {
    renderPostLine(withMedia());

    expect(screen.getByRole('button', { name: '[IMG 1/1: a wall]' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('opens the media lines of an ordinary post for a reader who auto-expands', () => {
    const state = appReducer(withMedia(), {
      type: 'settings',
      settings: { expandMedia: true },
    });

    renderPostLine(state);

    expect(screen.getByRole('img', { name: 'a wall' })).toBeInTheDocument();
  });

  it('keeps the media of a sensitive post closed even for a reader who auto-expands', () => {
    const state = appReducer(withMedia({ sensitive: true }), {
      type: 'settings',
      settings: { expandMedia: true },
    });

    renderPostLine(state);

    expect(screen.queryByRole('img')).toBeNull();
    expect(
      screen.getByRole('button', { name: '[SENSITIVE] [IMG 1/1: a wall]' }),
    ).toBeInTheDocument();
  });
});
