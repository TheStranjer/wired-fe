/**
 * What the composer window's poll tests share (AGENTS.md "Testing"): showing
 * the window of a state, and the few interactions every poll test repeats.
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { ComposerWindow } from './ComposerWindow';
import type { AppState } from '../../state/appState';
import { AppStateProvider } from '../../state/StateContext';

/** Show the composer window of {@link state}. */
export function renderComposer(state: AppState): void {
  render(
    <AppStateProvider initial={state}>
      <ComposerWindow windowId={state.windows.activeId} />
    </AppStateProvider>,
  );
}

/** The button named {@link name}. */
export function button(name: string | RegExp): HTMLElement {
  return screen.getByRole('button', { name });
}

/** Open the poll editor. */
export function openPoll(): void {
  fireEvent.click(button(/poll/u));
}

/** Type {@link text} into the field named {@link name}. */
export function typeInto(name: string, text: string): void {
  fireEvent.change(screen.getByRole('textbox', { name }), { target: { value: text } });
}

/** Fill the two options and the post text so the draft is sendable. */
export function fillValid(): void {
  typeInto('Post text', 'which?');
  typeInto('Option 1', 'cats');
  typeInto('Option 2', 'dogs');
}
