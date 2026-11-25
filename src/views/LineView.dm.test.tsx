/**
 * Tests for direct posts in the line views (WFE-234): a `direct` card in a feed
 * carries the `✉ DM` header and the accessible name of a direct message; in a DM
 * window the cards are chat bubbles, the viewer's own named `you` and a run of
 * one author's messages sharing one header; the lines density and posts that
 * are not direct are unchanged.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LineView } from './LineView';
import { type AppState, coreReducer } from '../state/appState';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { AppStateProvider } from '../state/StateContext';
import {
  ALICE,
  ALICE_REPLY,
  ALICE_THREAD,
  DM_REF,
  DM_WINDOW,
  dmState,
  showing,
} from '../test/dmWindow';
import { status } from '../test/fixtures';
import { LINE_SETTINGS } from '../test/lineSettings';
import { windowId } from '../windows/model';

const BOB_MENTION = {
  id: '10',
  username: 'bob',
  acct: 'bob@other.example',
  url: 'https://other.example/@bob',
};
const LAIN_MENTION = {
  id: '1',
  username: 'lain',
  acct: 'lain@wired.example',
  url: 'https://wired.example/@lain',
};

/** A direct post from alice naming lain and bob, and an ordinary one from lain. */
const SECRET = status('s1', {
  account: ALICE,
  visibility: 'direct',
  mentions: [LAIN_MENTION, BOB_MENTION],
  content: '<p>meet me in the wired</p>',
});
const PLAIN = status('p1', { content: '<p>hello world</p>' });

/** The home window next to the DM window, holding {@link SECRET} and {@link PLAIN}. */
const HOME_REF = { ...DM_REF, kind: 'home' as const, target: null };
const HOME = windowId(HOME_REF);

/** The DM state with a home feed opened beside it. */
function withHome(): AppState {
  const opened = coreReducer(dmState(), {
    type: 'windows',
    action: { type: 'open', ref: HOME_REF, title: 'home' },
  });
  return appReducer(opened, {
    type: 'statuses',
    windowId: HOME,
    statuses: [SECRET, PLAIN],
    where: 'newer',
  });
}

/** Render every line of window `id` over `state`. */
function renderWindow(state: AppState, id: string): void {
  render(
    <AppStateProvider initial={state}>
      {bufferFor(state, id).lines.map((line) => (
        <LineView key={line.key} line={line} windowId={id} />
      ))}
    </AppStateProvider>,
  );
}

describe('a direct post as a card in a feed', () => {
  it('has the DM header naming sender and recipients', () => {
    renderWindow(withHome(), HOME);

    expect(
      screen.getByText('✉ DM alice@other.example → you, bob@other.example'),
    ).toBeInTheDocument();
  });

  it('is named as a direct message, while an ordinary post keeps its name', () => {
    renderWindow(withHome(), HOME);

    expect(
      screen.getByRole('article', { name: /^Direct message \w+ from @alice@other\.example$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: /^Post \w+ by @lain@wired\.example$/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/✉ DM/)).toHaveLength(1);
  });

  it('keeps the plain row, with no DM header, when the window shows lines', () => {
    const state = withHome();
    renderWindow({ ...state, settings: LINE_SETTINGS }, HOME);

    expect(
      screen.getByRole('article', { name: /^Post \w+ by @alice@other\.example$/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/✉ DM/)).toBeNull();
  });
});

describe('direct posts in a DM window', () => {
  const state = showing(dmState(), ALICE_THREAD);

  it('names the viewer’s own message you, and the other side by name', () => {
    renderWindow(state, DM_WINDOW);

    expect(screen.getByText('you')).toBeInTheDocument();
    expect(screen.getAllByText('alice@other.example')).not.toHaveLength(0);
  });

  it('draws no DM header strip, the window being the conversation', () => {
    renderWindow(state, DM_WINDOW);

    expect(screen.queryByText(/✉ DM/)).toBeNull();
    expect(screen.getAllByRole('article', { name: /^Direct message / })).toHaveLength(4);
  });

  it('gives a run of one author’s messages a single header', () => {
    renderWindow(state, DM_WINDOW);

    expect(screen.getAllByRole('button', { name: '@alice@other.example' })).toHaveLength(1);
  });

  it('starts a new header when the author changes back', () => {
    const answered = showing(state, [{ ...ALICE_REPLY, id: '11' }]);
    renderWindow(answered, DM_WINDOW);

    expect(screen.getAllByRole('button', { name: '@alice@other.example' })).toHaveLength(2);
  });
});
