/**
 * The pieces the feed loader's tests share (AGENTS.md "Testing"): the sources
 * of the two test accounts, a feed over them, a post stamped `minutes` past
 * noon, and what a hosted feed window shows — its load and paging flag, and its
 * lines as one string (src/test/feedWindow) — plus a button asking the window
 * for older history, the way the navigation mode's key does.
 */

import { screen } from '@testing-library/react';
import type { JSX } from 'react';

import { minute } from './feedItems';
import { A_ACCOUNT, B_ACCOUNT, readLines } from './feedWindow';
import { status } from './fixtures';
import type { Status } from '../api/schemas/status';
import type { FeedSpec } from '../state/feeds';
import { bufferFor } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';

/** The sources the feed tests read: lain's home, local and notifications, navi's home. */
export const A_HOME = { accountKey: A_ACCOUNT.key, source: 'home' } as const;
export const A_LOCAL = { accountKey: A_ACCOUNT.key, source: 'local' } as const;
export const A_NOTIFICATIONS = { accountKey: A_ACCOUNT.key, source: 'notifications' } as const;
export const B_HOME = { accountKey: B_ACCOUNT.key, source: 'home' } as const;

/** A feed named `main`, id `f1`, over {@link sources}. */
export function feed(sources: FeedSpec['sources']): FeedSpec {
  return { id: 'f1', name: 'main', sources };
}

/** A post stamped `minutes` past noon, with the wire fields {@link extras} set. */
export function post(id: string, minutes: number, extras: Record<string, unknown> = {}): Status {
  return status(id, { created_at: minute(minutes), ...extras });
}

/** The window's load, paging flag and lines, as two readable elements. */
export function Probe(props: { readonly windowId: string }): JSX.Element {
  const buffer = bufferFor(useAppState(), props.windowId);

  return (
    <>
      <p>{`load:${buffer.load} exhausted:${String(buffer.exhausted)}`}</p>
      <section aria-label="lines">{readLines(buffer)}</section>
    </>
  );
}

/** Ask the window for older history, like the navigation mode's key does. */
export function OlderButton(props: { readonly windowId: string }): JSX.Element {
  const dispatch = useAppDispatch();

  return (
    <button
      onClick={() => {
        dispatch({ type: 'requestOlder', windowId: props.windowId });
      }}
      type="button"
    >
      load older
    </button>
  );
}

/** What the lines section reads. */
export function lines(): HTMLElement {
  return screen.getByRole('region', { name: 'lines' });
}
