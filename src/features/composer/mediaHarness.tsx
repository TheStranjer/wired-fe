/**
 * What the composer media tests share (AGENTS.md "Testing"): files, the
 * attachment the instance answers an upload with, handlers for the upload and
 * alt-text endpoints, and a render of composer windows over a session built
 * through the real reducer. Uploads answer ids `m1`, `m2`… in the order they
 * arrive, so a test that waits for one line before the next knows each id.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { assert } from 'vitest';

import { LAIN, WIRED, openedComposer } from './composerSession';
import { ComposerWindow } from './ComposerWindow';
import {
  DEFAULT_POLL_LIMITS,
  NO_ANONYMOUS_READS,
  type FeatureFlag,
} from '../../capabilities/capabilities';
import type { AppState } from '../../state/appState';
import { composerWindowOpen } from '../../state/composerWindow';
import { appReducer } from '../../state/reducer';
import { AppStateProvider } from '../../state/StateContext';

/** A picture file named {@link name}. */
export function picture(name: string): File {
  return new File(['pixels'], name, { type: 'image/png' });
}

/** The attachment the instance answers an upload of id {@link id} with. */
export function attachment(id: string): Record<string, unknown> {
  return {
    id,
    type: 'image',
    url: `${WIRED}/media/${id}.png`,
    preview_url: `${WIRED}/media/${id}.thumb.png`,
    remote_url: null,
    description: null,
    blurhash: null,
  };
}

/** A handler for lain's instance that accepts uploads, answering `m1`, `m2`… in turn. */
export function acceptingUploads(): ReturnType<typeof http.post> {
  let count = 0;
  return http.post(`${WIRED}/api/v2/media`, () => {
    count += 1;

    return HttpResponse.json(attachment(`m${String(count)}`));
  });
}

/** {@link state} with a second composer open, the active window. */
export function withSecondComposer(state: AppState): AppState {
  return appReducer(state, {
    type: 'windows',
    action: composerWindowOpen(LAIN, state.windows.windows),
  });
}

/** Show the composer windows {@link ids} of {@link state}, side by side. */
export function renderComposers(state: AppState, ids: readonly string[]): void {
  render(
    <AppStateProvider initial={state}>
      {ids.map((id) => (
        <ComposerWindow key={id} windowId={id} />
      ))}
    </AppStateProvider>,
  );
}

/** The {@link nth} pane's hidden file input. */
export function fileInput(nth = 0): HTMLInputElement {
  const input = screen.getAllByLabelText<HTMLInputElement>('Media files')[nth];
  assert(input !== undefined, 'no such file input');

  return input;
}

/** Choose {@link files} in the {@link nth} pane's file dialog, as the browser reports it. */
export function choose(files: readonly File[], nth = 0): void {
  const input = fileInput(nth);
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
}

/** Close the {@link nth} pane's file dialog without choosing anything: the input reports no list. */
export function chooseNothing(nth = 0): void {
  const input = fileInput(nth);
  Object.defineProperty(input, 'files', { value: null, configurable: true });
  fireEvent.change(input);
}

/** The pane the first composer window of {@link state} draws in. */
export function showComposer(state: AppState = openedComposer()): void {
  renderComposers(state, [state.windows.activeId]);
}

/** A session with one composer whose instance allows {@link max} attachments. */
export function cappedAt(max: number): AppState {
  return openedComposer([
    {
      type: 'profile',
      profile: {
        origin: WIRED,
        title: 'wired',
        capabilities: {
          backend: 'wired',
          maxCharacters: 30,
          maxMediaAttachments: max,
          pollLimits: DEFAULT_POLL_LIMITS,
          features: new Set<FeatureFlag>(['localOnlyPosts']),
          anonymousReads: NO_ANONYMOUS_READS,
        },
      },
    },
  ]);
}
