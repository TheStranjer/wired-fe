/**
 * Refusal tests for /vote: every one comes back before any request, so no
 * handler is registered and any network call would fail the test. A post
 * without a poll, a closed poll and a ballot this account already cast are
 * refused by name; a number or word the options do not reach, an option twice,
 * two options on a single-choice poll and an empty ballot name the legal
 * numbers; and nothing runs while nobody is signed in.
 */
import { describe, expect, it } from 'vitest';

import { command } from './vote';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import { type AppState, initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { status } from '../../test/fixtures';
import { type WindowRef, windowId } from '../../windows/model';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** The signed-in account whose home window shows the posts. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
};

/** Lain's home window: the active window the target resolver reads. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

const HOME_ID = windowId(HOME);

/** The open two-option single-choice poll as the wire sends it. */
const POLL_WIRE = {
  id: 'poll1',
  expired: false,
  multiple: false,
  votes_count: 42,
  options: [
    { title: 'Tabs', votes_count: 25 },
    { title: 'Spaces', votes_count: 17 },
  ],
  voted: false,
};

/** A post carrying {@link POLL_WIRE}. */
const WITH_POLL = status('p', { poll: POLL_WIRE });

/** The same poll on a multiple-choice post. */
const MULTIPLE = status('m', { poll: { ...POLL_WIRE, multiple: true } });

/** The same poll after it closed. */
const CLOSED = status('c', { poll: { ...POLL_WIRE, expired: true } });

/** The same poll this account has already voted on. */
const VOTED = status('v', { poll: { ...POLL_WIRE, voted: true, own_votes: [0] } });

/** A post with no poll at all. */
const NO_POLL = status('n');

/**
 * The signed-in state with lain's home window showing {@link posts} (API
 * order, newest first) and {@link selectedId} selected when one is given.
 */
function homeState(posts: readonly Status[], selectedId: string | null): AppState {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const opened = appReducer(signedIn, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: posts,
    where: 'newer',
  });
  if (selectedId === null) {
    return filled;
  }
  return appReducer(filled, { type: 'select', windowId: HOME_ID, key: `post:${selectedId}` });
}

/** A context whose active window shows {@link posts}, {@link selectedId} selected. */
function homeContext(posts: readonly Status[], selectedId: string | null = null): CommandContext {
  const state = homeState(posts, selectedId);
  return fakeCommandContext({ state, windows: state.windows });
}

describe('/vote refusals', () => {
  it('refuses a post without a poll', async () => {
    const context = homeContext([NO_POLL]);

    const outcome = await command.run('a0 1', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'No poll on [a0]' });
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('refuses a poll that has closed', async () => {
    const context = homeContext([CLOSED]);

    const outcome = await command.run('a0 1', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'That poll is closed' });
  });

  it('refuses where this account has already voted', async () => {
    const context = homeContext([VOTED]);

    const outcome = await command.run('a0 1', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'You already voted' });
  });

  it('refuses a number the options do not reach', async () => {
    const context = homeContext([WITH_POLL]);

    const past = await command.run('a0 3', context);
    const zero = await command.run('a0 0', context);

    expect(past).toStrictEqual({ ok: false, message: 'Options are 1–2' });
    expect(zero).toStrictEqual({ ok: false, message: 'Options are 1–2' });
  });

  it('refuses a word that is no option number', async () => {
    const context = homeContext([WITH_POLL]);

    const outcome = await command.run('a0 tabs', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Options are 1–2' });
  });

  it('refuses the same option twice', async () => {
    const context = homeContext([MULTIPLE]);

    const outcome = await command.run('a0 2 2', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Pick one option (1–2)' });
  });

  it('refuses two options on a single-choice poll', async () => {
    const context = homeContext([WITH_POLL]);

    const outcome = await command.run('a0 1 2', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Pick one option (1–2)' });
  });

  it('refuses an empty ballot', async () => {
    const context = homeContext([WITH_POLL]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Pick one option (1–2)' });
  });

  it('refuses while nobody is signed in', async () => {
    const outcome = await command.run('a0 1', fakeCommandContext());

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
  });
});
