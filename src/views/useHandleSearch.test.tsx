/**
 * Tests for the handle search of the command line (WFE-300): the instance is
 * asked for the `@handle` at the caret only after a pause of 250 ms and with
 * two characters after the `@`, one accounts search with `resolve` where the
 * word names a remote account; the answers of Wired, Mastodon and Pleroma
 * read as the same handles, a word is asked once, an answer that arrives
 * after the word changed is dropped, a failed search is silent and without
 * an account nothing is asked. Time is faked and the search call is mocked —
 * it has its own tests with the same fixtures.
 */
import { act, renderHook } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleWordAt, useHandleSearch } from './useHandleSearch';
import { type SearchResults, search } from '../api/endpoints/search';
import type { ApiError } from '../api/errors';
import { AccountSchema } from '../api/schemas/account';
import { type Result, err, ok } from '../lib/result';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { ACCOUNT } from '../test/completionSessions';
import { BACKENDS, WIRED_ACCOUNT } from '../test/searchAccounts';

vi.mock(import('../api/endpoints/search'), async (importOriginal) => ({
  ...(await importOriginal()),
  search: vi.fn(),
}));

const searchMock = vi.mocked(search);

/** What the three backends all read as. */
const ALEX = [{ word: '@alex@o.example', name: 'Alex Mercer' }];

/** The search answering with the accounts {@link wires} describe. */
function found(wires: readonly Record<string, unknown>[]): Result<SearchResults, ApiError> {
  const accounts = wires.map((wire) => v.parse(AccountSchema, wire));
  return ok({ accounts, statuses: [], hashtags: [] });
}

/** The session with {@link ACCOUNT} signed in. */
const SIGNED_IN = appReducer(initialAppState(), {
  type: 'accounts',
  accounts: [ACCOUNT],
  activeKey: ACCOUNT.key,
});

/** The hook over a session where {@link ACCOUNT} is signed in. */
function SignedIn(props: { readonly children: ReactNode }): JSX.Element {
  return <AppStateProvider initial={SIGNED_IN}>{props.children}</AppStateProvider>;
}

/** The hook over a session nobody has signed in to. */
function SignedOut(props: { readonly children: ReactNode }): JSX.Element {
  return <AppStateProvider initial={initialAppState()}>{props.children}</AppStateProvider>;
}

/** Mounts the hook on {@link word}, over the session of {@link wrapper}. */
function mount(word: string | null, wrapper = SignedIn) {
  return renderHook((props: { word: string | null }) => useHandleSearch(props.word), {
    initialProps: { word },
    wrapper,
  });
}

/** Makes every search wait for its answer: the list collects how to give each one, in call order. */
function unansweredSearches(): ((outcome: Result<SearchResults, ApiError>) => void)[] {
  const answers: ((outcome: Result<SearchResults, ApiError>) => void)[] = [];
  searchMock.mockImplementation(
    async () =>
      await new Promise<Result<SearchResults, ApiError>>((resolve) => {
        answers.push(resolve);
      }),
  );
  return answers;
}

/** Lets {@link ms} of fake time pass and what waits on the mocked call settle. */
async function pause(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe(handleWordAt, () => {
  it.each([
    ['@al', 3, '@al'],
    ['hi @alice', 9, '@alice'],
    ['hi @alice and', 9, '@alice'],
    ['hi\n@alice', 9, '@alice'],
    ['@alice@o.example', 16, '@alice@o.example'],
  ])('finds the handle %j at the caret %j', (text, caret, word) => {
    expect(handleWordAt(text, caret)).toBe(word);
  });

  it.each([
    ['@a', 2],
    ['@', 1],
    ['hello', 5],
    ['mail me@o.example', 17],
    ['@alice ', 7],
    ['/home', 5],
  ])('finds none in %j at the caret %j', (text, caret) => {
    expect(handleWordAt(text, caret)).toBeNull();
  });
});

describe(useHandleSearch, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    searchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(BACKENDS)(
    'asks the instance after the pause and reads %s the same',
    async (_name, wire) => {
      searchMock.mockResolvedValue(found([wire]));
      const { result } = mount('@Al');

      await pause(249);

      expect(searchMock).not.toHaveBeenCalled();

      await pause(1);

      expect(searchMock).toHaveBeenCalledExactlyOnceWith(
        { origin: ACCOUNT.origin, token: ACCOUNT.token },
        'Al',
        { type: 'accounts', resolve: false, limit: 10 },
        expect.any(AbortSignal),
      );
      expect(result.current.get('@al')).toStrictEqual(ALEX);
    },
  );

  it('asks to resolve a word that names a remote account', async () => {
    searchMock.mockResolvedValue(found([]));
    mount('@alex@o.example');

    await pause(250);

    expect(searchMock).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      'alex@o.example',
      { type: 'accounts', resolve: true, limit: 10 },
      expect.any(AbortSignal),
    );
  });

  it('asks only for the word the typing paused on', async () => {
    searchMock.mockResolvedValue(found([]));
    const { rerender } = mount('@al');

    await pause(200);
    rerender({ word: '@ali' });
    await pause(200);

    expect(searchMock).not.toHaveBeenCalled();

    await pause(50);

    expect(searchMock).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      'ali',
      expect.anything(),
      expect.any(AbortSignal),
    );
  });

  it('drops an answer that arrives after the word changed', async () => {
    const answers = unansweredSearches();
    const { result, rerender } = mount('@al');
    await pause(250);

    rerender({ word: '@ali' });
    await pause(250);
    answers[0]?.(found([WIRED_ACCOUNT]));
    await pause(0);

    expect(answers).toHaveLength(2);
    expect(result.current.size).toBe(0);

    answers[1]?.(found([]));
    await pause(0);

    expect([...result.current.keys()]).toStrictEqual(['@ali']);
  });

  it('asks a word once and keeps what it found while the caret is elsewhere', async () => {
    searchMock.mockResolvedValue(found([WIRED_ACCOUNT]));
    const { result, rerender } = mount('@al');
    await pause(250);

    rerender({ word: null });
    await pause(250);
    rerender({ word: '@AL' });
    await pause(250);

    expect(searchMock).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      'al',
      expect.anything(),
      expect.any(AbortSignal),
    );
    expect(result.current.get('@al')).toStrictEqual(ALEX);
  });

  it('stays silent when the search fails, and does not ask again for it', async () => {
    searchMock.mockResolvedValue(err({ kind: 'network', message: 'down' }));
    const { result } = mount('@al');

    await pause(250);

    expect(result.current.size).toBe(0);
    expect(searchMock).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      'al',
      expect.anything(),
      expect.any(AbortSignal),
    );
  });

  it('asks nothing without a handle at the caret or without an account', async () => {
    searchMock.mockResolvedValue(found([]));
    mount(null);
    mount('@al', SignedOut);

    await pause(1000);

    expect(searchMock).not.toHaveBeenCalled();
  });
});
