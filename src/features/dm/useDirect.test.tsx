/**
 * Tests for the DM hook: while the window is idle its buffer moves to a
 * loading conversation — one served paged fetch of the list, the thread and
 * the read mark over MSW (src/test/dmWindow) — and the scrollback ends up
 * reading the conversation top to bottom under an exhausted load. A handle
 * with no conversation says so into the window and closes the load the same
 * way; a failed fetch prints its description and fails it. No target, no
 * account, or a buffer that is not idle mean no request at all. The job's
 * own dispatch sequence is useDirect.fetch.test.tsx.
 */
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { useDirect } from './useDirect';
import type { AppState } from '../../state/appState';
import { bufferFor } from '../../state/selectors';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import {
  BOB_CONVERSATION,
  DM_TARGETLESS,
  DM_WINDOW,
  dmState,
  serveDirect,
  withTargetless,
} from '../../test/dmWindow';
import { unsigned } from '../../test/threadWindow';
import { BufferView } from '../../views/BufferView';

/** The window's own flags, spelled out beside its scrollback. */
function Probe(props: { readonly windowId: string }): JSX.Element {
  const { load, exhausted } = bufferFor(useAppState(), props.windowId);

  return <span>{`load:${load} exhausted:${String(exhausted)}`}</span>;
}

/** Runs the hook under test and renders the window's lines. */
function Loader(props: { readonly windowId: string }): JSX.Element {
  useDirect(props.windowId);

  return <BufferView label="dm" windowId={props.windowId} />;
}

/** {@link hook} over {@link state}, its window's scrollback along for the prints. */
function Host(props: { readonly windowId: string; readonly state: AppState }): JSX.Element {
  return (
    <AppStateProvider initial={props.state}>
      <Probe windowId={props.windowId} />
      <Loader windowId={props.windowId} />
    </AppStateProvider>
  );
}

/** The index of {@link marker} in the DM window's scrollback text. */
function indexOfMarker(marker: string): number {
  return screen.getByRole('log', { name: 'dm' }).textContent.indexOf(marker);
}

describe(useDirect, () => {
  it('reads the conversation top to bottom and closes the load', async () => {
    const marked = serveDirect();

    render(<Host windowId={DM_WINDOW} state={dmState()} />);

    await screen.findByText('load:loaded exhausted:true');

    expect(marked).toStrictEqual(['c1']);

    const places = ['close the world', 'hello?', 'present time', 'clones drift away'].map(
      indexOfMarker,
    );

    expect(places).toStrictEqual([...places].sort((a, b) => a - b));
    expect(places[0]).toBeGreaterThanOrEqual(0);
  });

  it('says nothing has been said yet when the list holds no match', async () => {
    serveDirect({ pages: [[BOB_CONVERSATION]] });

    render(<Host windowId={DM_WINDOW} state={dmState()} />);

    await screen.findByText('load:loaded exhausted:true');

    expect(screen.getByRole('log', { name: 'dm' })).toHaveTextContent(
      'No messages with @alice@other.example yet. Type to start one.',
    );
  });

  it('prints a failed fetch into the window', async () => {
    serveDirect({ listFail: true });

    render(<Host windowId={DM_WINDOW} state={dmState()} />);

    await screen.findByText('load:error exhausted:false');

    expect(screen.getByRole('log', { name: 'dm' })).toHaveTextContent('HTTP 500: Boom');
  });

  it('fetches nothing when the buffer is not idle', async () => {
    // No handlers are registered: any request would fail this test.
    render(<Host windowId={DM_WINDOW} state={dmState(true)} />);

    await screen.findByText('load:loaded exhausted:false');

    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('fetches nothing when the window has no target', async () => {
    const state = withTargetless(dmState());

    render(<Host windowId={DM_TARGETLESS} state={state} />);

    await screen.findByText('load:idle exhausted:false');

    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('fetches nothing when the window has no account', async () => {
    render(<Host windowId={DM_WINDOW} state={unsigned(dmState())} />);

    await screen.findByText('load:idle exhausted:false');

    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });
});
