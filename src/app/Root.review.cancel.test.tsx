/**
 * Tests for cancelling the alt-text review of a command-line send, through the
 * whole shell (WFE-294): the reader chose to cancel, so there is no error
 * alert and no error line, nothing is sent, the pending media stay pending and
 * the line they typed is back on the command line — for plain text, `/cw`,
 * `/poll`, `/vis <word> <text>` and the text after `/home`. Startup is mocked.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { DEFAULT_POLL_LIMITS, NO_ANONYMOUS_READS } from '../capabilities/capabilities';
import type { AppAction } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { stateAfter } from '../test/appSessions';
import { ACCOUNT, ORIGIN } from '../test/attachmentHarness';
import { attachOne, seen, serveInstance, submit } from '../test/trayHarness';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** A detected, signed-in session with its home window open, so `/poll` has limits to check. */
const SESSION: readonly AppAction[] = [
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
  {
    type: 'profile',
    profile: {
      origin: ORIGIN,
      title: 'wired.example',
      capabilities: {
        backend: 'wired',
        maxCharacters: 500,
        maxMediaAttachments: 4,
        pollLimits: DEFAULT_POLL_LIMITS,
        features: new Set(),
        anonymousReads: NO_ANONYMOUS_READS,
      },
    },
  },
  {
    type: 'windows',
    action: {
      type: 'open',
      ref: { kind: 'home', accountKey: ACCOUNT.key, target: null },
      title: 'home',
    },
  },
];

/** The lines that send and then wait on the review, each with the post it makes. */
const LINES = [
  'look at this',
  '/cw spoilers look at this',
  '/poll "which way?" "the wire" "the window"',
  '/vis private look at this',
  '/home look at this',
] as const;

/** Neither the error alert nor a success line was raised. */
function expectNothingAnnounced(): void {
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.queryByText('poll posted')).toBeNull();
}

describe('cancelling the alt-text review of a command-line send', () => {
  beforeEach(() => {
    serveInstance(200);
  });

  it.each(LINES)('stays silent and keeps the media and the line for %s', async (typed) => {
    const { container } = render(
      <AppStateProvider initial={stateAfter(SESSION)}>
        <Root />
      </AppStateProvider>,
    );
    act(() => {
      screen.getByRole('combobox', { name: 'Command line' }).focus();
    });
    await attachOne(container);

    submit(typed);
    await screen.findByRole('dialog', { name: 'Describe media' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Describe media' })).toBeNull();
    });

    expectNothingAnnounced();

    expect(screen.getByRole('list', { name: 'Pending media' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Command line' })).toHaveValue(typed);
    expect(seen()).toStrictEqual([]);
  });
});
