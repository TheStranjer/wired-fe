/**
 * Tests for `/attach` while a composer window is focused (WFE-245): the files
 * the dialog returns become that composer's own media, carrying the alt text
 * the command was given, and the command line's pending list stays empty; with
 * another window focused they are pending as ever.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { type Attachments, useAttachments } from './useAttachments';
import { openedComposer } from '../features/composer/composerSession';
import { acceptingUploads } from '../features/composer/mediaHarness';
import type { AppState } from '../state/appState';
import { composerMediaOf } from '../state/composerMedia';
import type { AppAction } from '../state/reducer';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { choose, fileInput, picture } from '../test/attachmentHarness';
import { server } from '../test/server';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The hook and the state behind it, as the last render handed them over. */
type Snapshot = { readonly attachments: Attachments; readonly state: AppState };

/** Renders the hook's file input and its count of the pending list, reporting every render. */
function Harness(props: { readonly report: (next: Snapshot) => void }): JSX.Element {
  const attachments = useAttachments();
  const state = useAppState();
  const { report } = props;
  useEffect(() => {
    report({ attachments, state });
  });
  return (
    <>
      {attachments.input}
      <span>{`pending:${String(attachments.pending.length)}`}</span>
    </>
  );
}

/** Mount the harness over {@link initial}; the container and the last render's snapshot. */
function mount(initial: AppState): {
  readonly container: HTMLElement;
  readonly current: () => Snapshot;
} {
  let captured: Snapshot | null = null;
  const { container } = render(
    <AppStateProvider initial={initial}>
      <Harness
        report={(next) => {
          captured = next;
        }}
      />
    </AppStateProvider>,
  );
  return {
    container,
    current(): Snapshot {
      if (captured === null) {
        throw new Error('the harness never rendered');
      }
      return captured;
    },
  };
}

describe('attaching with a composer focused', () => {
  it('gives the chosen files to that composer, described, and holds nothing pending', async () => {
    server.use(acceptingUploads());
    const state = openedComposer();
    const mounted = mount(state);
    const windowId = state.windows.activeId;

    act(() => {
      mounted.current().attachments.pick('a wall at night');
    });
    choose(fileInput(mounted.container), [picture('pixel.png')]);

    await waitFor(() => {
      expect(composerMediaOf(mounted.current().state, windowId)).toMatchObject([
        { name: 'pixel.png', status: 'ready', mediaId: 'm1', description: 'a wall at night' },
      ]);
    });

    expect(screen.getByText('pending:0')).toBeInTheDocument();
  });

  it('holds the files for the next post when another window is focused', async () => {
    server.use(acceptingUploads());
    const focusStatus: AppAction = {
      type: 'windows',
      action: { type: 'activate', id: STATUS_WINDOW_ID },
    };
    const mounted = mount(openedComposer([focusStatus]));

    choose(fileInput(mounted.container), [picture('pixel.png')]);

    const pending = await screen.findByText('pending:1');

    expect(pending).toBeInTheDocument();
  });
});
