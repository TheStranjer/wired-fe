/**
 * Tests for `/feed` completion (decision 6 and 14): the first argument offers
 * subcommands and feed names, the feed argument of the subcommands that take
 * one offers feed names, and source words offer `*` and every signed-in
 * account's handle with the source kinds; nothing else completes.
 */
import { describe, expect, it } from 'vitest';

import { startCompletion } from './complete';
import { feedProvider } from './feedWords';
import { accountKey } from '../accounts/accountStore';
import { type AppState, coreReducer, initialAppState } from '../state/appState';

/** A session with lain signed in and two saved feeds. */
function session(): AppState {
  const account = {
    key: accountKey('https://wired.example', '1'),
    origin: 'https://wired.example',
    accountId: '1',
    handle: 'lain@wired.example',
    token: 'never-logged',
    refreshToken: null,
    expiresAt: null,
  };
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [account],
    activeKey: account.key,
  });
  return coreReducer(signed, {
    type: 'settings',
    settings: {
      feeds: [
        { id: 'f1', name: 'main', sources: [] },
        { id: 'f2', name: 'Memes', sources: [] },
      ],
    },
  });
}

/** Every candidate Tab would cycle through for {@link text}. */
function candidates(text: string): readonly string[] {
  return startCompletion(text, text.length, [feedProvider(session())])?.state.candidates ?? [];
}

describe(feedProvider, () => {
  it('offers subcommands and feed names for the first argument', () => {
    expect(candidates('/feed n')).toStrictEqual(['new']);
    expect(candidates('/feed m')).toStrictEqual(['main', 'Memes']);
    expect(candidates('/FEED ~M')).toStrictEqual(['main', 'Memes']);
    expect(candidates('/feed r')).toStrictEqual(['rename', 'rm']);
  });

  it('offers feed names for the feed of open, add, rm, rename and delete', () => {
    for (const sub of ['open', 'add', 'rm', 'rename', 'delete']) {
      expect(candidates(`/feed ${sub} me`)).toStrictEqual(['Memes']);
    }
  });

  it('offers nothing for the name new makes up, or the new name of a rename', () => {
    expect(candidates('/feed new m')).toStrictEqual([]);
    expect(candidates('/feed rename main m')).toStrictEqual([]);
    expect(candidates('/feed open main m')).toStrictEqual([]);
    expect(candidates('/feed list m')).toStrictEqual([]);
  });

  it('offers who and source kinds for the source words of new, add and rm', () => {
    expect(candidates('/feed new main *:ho')).toStrictEqual(['*:home']);
    expect(candidates('/feed add main @lain@wired.example:t')).toStrictEqual([
      '@lain@wired.example:tag:',
    ]);
    expect(candidates('/feed rm main @LAIN@WIRED.EXAMPLE:N')).toStrictEqual([
      '@lain@wired.example:notifications',
    ]);
    expect(candidates('/feed new main *:home @l')).toStrictEqual([
      '@lain@wired.example:dms',
      '@lain@wired.example:federated',
      '@lain@wired.example:home',
      '@lain@wired.example:local',
      '@lain@wired.example:mentions',
      '@lain@wired.example:notifications',
      '@lain@wired.example:tag:',
    ]);
  });

  it('declines other commands, the command word itself and a line without a word to complete', () => {
    expect(candidates('/win m')).toStrictEqual([]);
    expect(candidates('/feed')).toStrictEqual([]);
  });

  it('offers nothing for a call without the text before the word', () => {
    expect(feedProvider(session()).candidates('ma')).toStrictEqual([]);
  });

  it('declines when the engine passes no line', () => {
    expect(feedProvider(session()).accepts('m', false)).toBe(false);
  });
});
