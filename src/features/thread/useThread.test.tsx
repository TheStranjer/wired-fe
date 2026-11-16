/**
 * Tests for the thread hook: while the window is idle its buffer moves to a
 * loading thread — one fetch of target and context over MSW (src/test/
 * threadWindow) — and the scrollback ends up reading ancestors → status →
 * replies top to bottom, with the selection on the target's line and the
 * load closed exhausted. A failed fetch prints its description into the
 * window and fails the load; no target, no account, or a buffer that is not
 * idle mean no request at all. The job's own dispatch sequence is
 * useThread.fetch.test.tsx.
 */
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { useThread } from './useThread';
import type { AppState } from '../../state/appState';
import { bufferFor } from '../../state/selectors';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import {
  serveThread,
  THREAD_NO_TARGET,
  THREAD_WINDOW,
  threadState,
  unsigned,
  withTargetless,
} from '../../test/threadWindow';
import { BufferView } from '../../views/BufferView';

/** The window's own flags, spelled out beside its scrollback. */
function Probe(props: { readonly windowId: string }): JSX.Element {
  const { load, exhausted, selectedKey } = bufferFor(useAppState(), props.windowId);

  return (
    <span>{`load:${load} exhausted:${String(exhausted)} selected:${selectedKey ?? '-'}`}</span>
  );
}

/** Runs the hook under test and renders the window's lines. */
function Loader(props: { readonly windowId: string }): JSX.Element {
  useThread(props.windowId);

  return <BufferView label="thread" windowId={props.windowId} />;
}

/** The hook over {@link state}, its window's scrollback along for the prints. */
function Host(props: { readonly windowId: string; readonly state: AppState }): JSX.Element {
  return (
    <AppStateProvider initial={props.state}>
      <Probe windowId={props.windowId} />
      <Loader windowId={props.windowId} />
    </AppStateProvider>
  );
}

/** The index of {@link marker} in the thread window's scrollback text. */
function indexOfMarker(marker: string): number {
  return screen.getByRole('log', { name: 'thread' }).textContent.indexOf(marker);
}

describe(useThread, () => {
  it('reads the thread top to bottom and selects its target line', async () => {
    serveThread();

    render(<Host windowId={THREAD_WINDOW} state={threadState()} />);

    await screen.findByText('load:loaded exhausted:true selected:post:5');

    const places = ['first up', 'second up', 'the fourth wall', 'first down', 'second down'].map(
      indexOfMarker,
    );

    expect(places).toStrictEqual([...places].sort((a, b) => a - b));
    expect(places[0]).toBeGreaterThanOrEqual(0);

    const selected = screen
      .getAllByRole('article')
      .filter((row) => row.getAttribute('aria-current') === 'true');

    expect(selected).toHaveLength(1);
    expect(selected[0]?.textContent).toContain('the fourth wall');
  });

  it('prints a failed fetch into the window', async () => {
    serveThread({ status: true });

    render(<Host windowId={THREAD_WINDOW} state={threadState()} />);

    await screen.findByText('load:error exhausted:false selected:-');

    expect(screen.getByRole('log', { name: 'thread' })).toHaveTextContent(
      'HTTP 404: Record not found',
    );
  });

  it('fetches nothing when the buffer is not idle', async () => {
    // No handlers are registered: any request would fail this test.
    render(<Host windowId={THREAD_WINDOW} state={threadState(true)} />);

    await screen.findByText('load:loaded exhausted:false selected:-');

    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('fetches nothing when the window has no target', async () => {
    const state = withTargetless(threadState());

    render(<Host windowId={THREAD_NO_TARGET} state={state} />);

    await screen.findByText('load:idle exhausted:false selected:-');

    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('fetches nothing when the window has no account', async () => {
    render(<Host windowId={THREAD_WINDOW} state={unsigned(threadState())} />);

    await screen.findByText('load:idle exhausted:false selected:-');

    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });
});
