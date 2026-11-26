/**
 * Tests for the input box docked in a thread window (WFE-286): Enter replies
 * to the target post and empties the box, `//text` posts a literal leading
 * slash, a `/` line runs through the line runner with the thread active and
 * its refusal shows inside the box; a failed send shows inside the box with
 * the text kept; the box is disabled while the target loads; focusing it
 * leaves navigation mode and activates the thread.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { type JSX, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThreadInput } from './ThreadInput';
import type { AppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import {
  ORIGIN,
  THREAD_TARGET,
  THREAD_WINDOW,
  threadState,
  withTargetless,
} from '../../test/threadWindow';
import { LineRunnerProvider, type LineRunner } from '../../views/LineRunnerContext';
import { activeWindow } from '../../windows/model';

const CREATE_URL = `${ORIGIN}/api/v1/statuses`;

/** The ids the app rendered as the active window, oldest first. */
type Seen = string[];

/** Shows the keyboard mode and the active window, and records the latter's id as the app renders it. */
function Probe(props: { readonly onActive: (id: string) => void }): JSX.Element {
  const state = useAppState();
  const active = activeWindow(state.windows).id;
  const { onActive } = props;
  useEffect(() => {
    onActive(active);
  }, [active, onActive]);
  return <output>{`${state.mode} ${active}`}</output>;
}

/** The thread window's box over {@link state}, its runner, and where the active window is recorded. */
function renderBox(
  state: AppState,
  runner: LineRunner = vi.fn<LineRunner>(),
  seen: Seen = [],
): void {
  const onActive = (id: string): void => {
    seen.push(id);
  };
  const win = state.windows.windows.find((candidate) => candidate.id === THREAD_WINDOW);
  if (win === undefined) {
    throw new Error('the thread window is not open');
  }
  render(
    <AppStateProvider initial={state}>
      <LineRunnerProvider runner={runner}>
        <ThreadInput win={win} />
        <Probe onActive={onActive} />
      </LineRunnerProvider>
    </AppStateProvider>,
  );
}

/** The thread window with its target on show. */
function loaded(): AppState {
  return appReducer(threadState(true), {
    type: 'statuses',
    windowId: THREAD_WINDOW,
    statuses: [THREAD_TARGET],
    where: 'newer',
  });
}

/** The box's textarea. */
function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

/** Type {@link text} into the box and press Enter. */
function typeAndSend(text: string): void {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.keyDown(field(), { key: 'Enter' });
}

/** Serve a create that records the body it was sent. */
function recordCreate(bodies: unknown[]): void {
  server.use(
    http.post(CREATE_URL, async ({ request }) => {
      bodies.push(await request.json());

      return HttpResponse.json(status('42'));
    }),
  );
}

describe(ThreadInput, () => {
  it('replies to the target post and empties the box', async () => {
    const bodies: unknown[] = [];
    recordCreate(bodies);
    renderBox(loaded());

    typeAndSend('hello thread');

    await waitFor(() => {
      expect(field()).toHaveValue('');
    });

    expect(bodies).toStrictEqual([
      {
        status: 'hello thread',
        visibility: 'public',
        in_reply_to_id: '5',
      },
    ]);
  });

  it('posts a literal leading slash for a line that starts with two', async () => {
    const bodies: unknown[] = [];
    recordCreate(bodies);
    const runner = vi.fn<LineRunner>();
    renderBox(loaded(), runner);

    typeAndSend('//hi');

    await waitFor(() => {
      expect(field()).toHaveValue('');
    });

    expect(bodies).toStrictEqual([{ status: '/hi', visibility: 'public', in_reply_to_id: '5' }]);
    expect(runner).not.toHaveBeenCalled();
  });

  it('shows a failed send inside the box and keeps the text', async () => {
    server.use(http.post(CREATE_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderBox(loaded());

    typeAndSend('this will fail');

    const failure = await screen.findByText(/HTTP 500/u);

    expect(failure).toBeInTheDocument();
    expect(field()).toHaveValue('this will fail');
  });

  it('runs a slash line through the line runner with the thread active, then empties the box', async () => {
    const seenActive: string[] = [];
    const seen: Seen = [];
    const runner = vi.fn<LineRunner>(async () => {
      seenActive.push(seen.at(-1) ?? '');
      return await Promise.resolve({ ok: true as const });
    });
    renderBox(withTargetless(loaded()), runner, seen);

    typeAndSend('/fav a1');

    await waitFor(() => {
      expect(field()).toHaveValue('');
    });

    expect(runner).toHaveBeenCalledExactlyOnceWith(['/fav a1']);
    expect(seenActive).toStrictEqual([THREAD_WINDOW]);
  });

  it('shows the refusal of a command inside the box and keeps the text', async () => {
    const runner = vi.fn<LineRunner>(
      async () => await Promise.resolve({ ok: false as const, message: 'No such post: a1' }),
    );
    renderBox(loaded(), runner);

    typeAndSend('/fav a1');

    const refusal = await screen.findByText('No such post: a1');

    expect(refusal).toBeInTheDocument();
    expect(field()).toHaveValue('/fav a1');
  });

  it('is disabled with a hint until the target post has loaded', () => {
    renderBox(threadState());

    expect(screen.getByPlaceholderText('Loading thread…')).toBeDisabled();
  });

  it('leaves navigation mode and activates the thread when focused', () => {
    renderBox(appReducer(withTargetless(loaded()), { type: 'mode', mode: 'navigation' }));

    fireEvent.focus(field());

    expect(screen.getByRole('status')).toHaveTextContent(`insert ${THREAD_WINDOW}`);
  });
});
