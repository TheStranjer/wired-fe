/**
 * Tests for `fetchDirect`, the conversation job the DM hook runs: paging to
 * alice's conversation, the thread around her last word arrives as one
 * newest-first `statuses` batch — which the buffer's own reversal turns into
 * top-to-bottom conversation order — the load closes exhausted, and the
 * conversation is marked read. A conversation that is not a one-on-one with
 * the target, or has no word to show, is looked past; a handle with no
 * conversation hears the window's own "no messages yet" line instead. A
 * failed fetch prints its description and fails the load, three pages is as
 * deep as the search goes, and a job whose window closed while the instance
 * was thinking reports nothing at all. The MSW conversation comes from
 * src/test/dmWindow.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { fetchDirect, type DirectJob } from './useDirect';
import type { Status } from '../../api/schemas/status';
import type { Dispatch } from '../../state/StateContext';
import {
  ALICE,
  ALICE_CONVERSATION,
  ALICE_LAST,
  ALICE_THREAD,
  BOB_CONVERSATION,
  DM_SESSION,
  DM_TARGET,
  DM_TARGETLESS,
  DM_WINDOW,
  EMPTY_CONVERSATION,
  GROUP_CONVERSATION,
  serveDirect,
  wireAccount,
  wireConversation,
} from '../../test/dmWindow';
import { status } from '../../test/fixtures';
import { withSession } from '../../test/withToken';

/** The line a window with nothing to show says. */
const NO_MESSAGES = 'No messages with @alice@other.example yet. Type to start one.';

/** A job fetching alice's conversation into a DM window, aborted when told. */
function jobFor(
  dispatch: Dispatch,
  signal = new AbortController().signal,
  windowId: string = DM_WINDOW,
): DirectJob {
  return { withToken: withSession(DM_SESSION), target: DM_TARGET, windowId, signal, dispatch };
}

/** The actions a recorded dispatch saw, in order. */
function dispatched(dispatch: Mock<Dispatch>): readonly unknown[] {
  return dispatch.mock.calls.map((call) => call[0]);
}

/** The batch and the closed load a found conversation reports, in order. */
const SHOWN: readonly unknown[] = [
  { type: 'statuses', windowId: DM_WINDOW, statuses: ALICE_THREAD.toReversed(), where: 'newer' },
  { type: 'load', windowId: DM_WINDOW, load: 'loaded', exhausted: true },
];

/** The "say so" pair a search that came up empty closes the load with. */
const NOTHING_LOADED: unknown = {
  type: 'load',
  windowId: DM_WINDOW,
  load: 'loaded',
  exhausted: true,
};

/** The print half of that pair, matched loosely for its date. */
const NOTHING_PRINTED = {
  type: 'print',
  windowId: DM_WINDOW,
  level: 'info',
  text: NO_MESSAGES,
} as const;

/** {@link ALICE_CONVERSATION} rewritten into an older one leading elsewhere. */
function olderThanAlice(ledBy: Status): Record<string, unknown> {
  return { ...ALICE_CONVERSATION, id: 'c0', last_status: ledBy };
}

describe(fetchDirect, () => {
  it('delivers the thread newest-first, an exhausted load, and the read mark', async () => {
    const marked = serveDirect();
    const dispatch = vi.fn<Dispatch>();

    await fetchDirect(jobFor(dispatch));

    expect(dispatched(dispatch)).toStrictEqual(SHOWN);
    expect(marked).toStrictEqual(['c1']);
  });

  it('finds the conversation whatever case its acct comes with', async () => {
    const mixed = wireConversation('c1', [wireAccount('9', 'Alice@Other.Example')], ALICE_LAST);
    const marked = serveDirect({ pages: [[mixed]] });
    const dispatch = vi.fn<Dispatch>();

    await fetchDirect(jobFor(dispatch));

    expect(dispatched(dispatch)).toStrictEqual(SHOWN);
    expect(marked).toStrictEqual(['c1']);
  });

  it("pages past group and other people's conversations to find it", async () => {
    const marked = serveDirect({
      pages: [[GROUP_CONVERSATION, BOB_CONVERSATION], [ALICE_CONVERSATION]],
    });
    const dispatch = vi.fn<Dispatch>();

    await fetchDirect(jobFor(dispatch));

    expect(dispatched(dispatch)).toStrictEqual(SHOWN);
    expect(marked).toStrictEqual(['c1']);
  });

  it('takes the newest match, reading no older conversation behind it', async () => {
    const marked = serveDirect({
      pages: [[ALICE_CONVERSATION, olderThanAlice(status('4', { account: ALICE }))]],
    });
    const dispatch = vi.fn<Dispatch>();

    await fetchDirect(jobFor(dispatch));

    expect(dispatched(dispatch)).toStrictEqual(SHOWN);
    expect(marked).toStrictEqual(['c1']);
  });

  it("says nothing has been said when no conversation is the target's alone", async () => {
    serveDirect({ pages: [[BOB_CONVERSATION, GROUP_CONVERSATION, EMPTY_CONVERSATION]] });
    const dispatch = vi.fn<Dispatch>();

    await fetchDirect(jobFor(dispatch));

    const calls = dispatched(dispatch);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject(NOTHING_PRINTED);
    expect(calls[1]).toStrictEqual(NOTHING_LOADED);
  });

  it('searches no deeper than three pages', async () => {
    serveDirect({
      pages: [[BOB_CONVERSATION], [GROUP_CONVERSATION], [BOB_CONVERSATION], [ALICE_CONVERSATION]],
    });
    const dispatch = vi.fn<Dispatch>();

    await fetchDirect(jobFor(dispatch));

    const calls = dispatched(dispatch);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject(NOTHING_PRINTED);
    expect(calls[1]).toStrictEqual(NOTHING_LOADED);
  });

  it('prints a failed conversation list once and fails the load', async () => {
    serveDirect({ listFail: true });
    const dispatch = vi.fn<Dispatch>();

    await fetchDirect(jobFor(dispatch));

    const calls = dispatched(dispatch);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ type: 'print', level: 'error', text: 'HTTP 500: Boom' });
    expect(calls[1]).toStrictEqual({ type: 'load', windowId: DM_WINDOW, load: 'error' });
  });

  it('prints a failed context answer and marks nothing read', async () => {
    const marked = serveDirect({ contextFail: true });
    const dispatch = vi.fn<Dispatch>();

    await fetchDirect(jobFor(dispatch));

    const calls = dispatched(dispatch);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ type: 'print', level: 'error', text: 'HTTP 404: No context' });
    expect(calls[1]).toStrictEqual({ type: 'load', windowId: DM_WINDOW, load: 'error' });
    expect(marked).toStrictEqual([]);
  });

  it('reports nothing once the window it answers has closed', async () => {
    serveDirect();
    const controller = new AbortController();
    controller.abort();
    const dispatch = vi.fn<Dispatch>();

    await fetchDirect(jobFor(dispatch, controller.signal, DM_TARGETLESS));

    expect(dispatch).not.toHaveBeenCalled();
  });
});
