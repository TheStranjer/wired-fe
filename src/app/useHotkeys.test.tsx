/**
 * Tests for the wired hotkeys: mode chords dispatch `mode` and carry the caret
 * (navigation blurs the command line, insert focuses it), a bound chord runs
 * its command line through the dispatcher, an unbound chord is left alone, a
 * chord pressed inside a modal dialog belongs to the dialog, and refused
 * keymap bindings print as warnings into the status window once, on mount.
 * textHandler itself: it posts the text and prints the window's refusal.
 * Prefill chords have their own file, useHotkeys.prefill.test.tsx.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import type { JSX, RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { textHandler, useHotkeys } from './useHotkeys';
import { buildRegistry } from '../commands/registry';
import type { CommandContext, CommandOutcome, Registry } from '../commands/types';
import { usePendingKeys } from '../keys/useGlobalKeys';
import { initialAppState } from '../state/appState';
import { fakeCommandContext } from '../test/commandContext';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The one outcome a stub command reports. */
const OK: CommandOutcome = { ok: true };

/** Records every run of /probe; the tests hand it to the registry. */
const PROBE_RUN = vi.fn(async (): Promise<CommandOutcome> => await Promise.resolve(OK));

/** The probe command, bound to navigation-mode `p` -> `/probe x`. */
const PROBE = {
  name: 'probe',
  aliases: [],
  usage: '/probe <word>',
  summary: 'Probe the hotkey path',
  run: PROBE_RUN,
  bindings: [{ mode: 'navigation', chord: 'p', args: 'x' }],
} as const;

/** A command whose only binding would block typing in insert mode. */
const BLOCKER = {
  name: 'blocker',
  aliases: [],
  usage: '/blocker',
  summary: 'Bind a chord that would block typing',
  run: async (): Promise<CommandOutcome> => await Promise.resolve(OK),
  bindings: [{ mode: 'insert', chord: 'x', args: '' }],
} as const;

/** The registry over {@link definitions}; a build failure is a broken test. */
function registryOf(definitions: readonly (typeof PROBE | typeof BLOCKER)[]): Registry {
  const built = buildRegistry(definitions);
  if (!built.ok) {
    throw new Error(built.error);
  }
  return built.value;
}

/** The context of a session in {@link mode}, carrying `blocker` when {@link refused}. */
function hotkeyContext(mode: 'insert' | 'navigation', refused = false): CommandContext {
  const definitions = refused ? ([PROBE, BLOCKER] as const) : ([PROBE] as const);
  const state = { ...initialAppState(), mode };
  return fakeCommandContext({ state, registry: registryOf(definitions) });
}

/** Props of the test component {@link Host}. */
type HostProps = {
  readonly context: CommandContext;
};

/** A component that mounts the hook under test over one plain input. */
function Host({ context }: HostProps): JSX.Element {
  const inputRef: RefObject<HTMLInputElement | null> = useRef<HTMLInputElement>(null);
  useHotkeys(inputRef, context, usePendingKeys(context.state.mode));
  return <input aria-label="command line" ref={inputRef} />;
}

/** Mounts the host over {@link context} and returns its focused input. */
function mountFocusedHost(context: CommandContext): HTMLElement {
  render(<Host context={context} />);
  const input = screen.getByRole('textbox', { name: 'command line' });
  input.focus();
  return input;
}

describe(useHotkeys, () => {
  it('Escape dispatches navigation and blurs the command line', () => {
    const context = hotkeyContext('insert');
    const input = mountFocusedHost(context);

    const prevented = fireEvent.keyDown(window, { key: 'Escape' });

    expect(prevented).toBe(false);
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'mode', mode: 'navigation' });
    expect(input).not.toHaveFocus();
  });

  it.each([
    { key: 'i', name: 'i' },
    { key: 'Enter', name: 'Enter' },
  ])('$name dispatches insert and focuses the command line', ({ key }) => {
    const context = hotkeyContext('navigation');
    const input = mountFocusedHost(context);
    input.blur();

    fireEvent.keyDown(window, { key });

    expect(context.dispatch).toHaveBeenCalledWith({ type: 'mode', mode: 'insert' });
    expect(input).toHaveFocus();
  });

  it('runs the chord’s bound command line through the dispatcher', async () => {
    const context = hotkeyContext('navigation');
    mountFocusedHost(context);

    const prevented = fireEvent.keyDown(window, { key: 'p' });
    await waitFor(() => {
      expect(PROBE_RUN).toHaveBeenCalledWith('x', context);
    });

    expect(prevented).toBe(false);
  });

  it('leaves a chord the keymap does not bind to the keyboard', () => {
    const context = hotkeyContext('insert');
    mountFocusedHost(context);

    const notPrevented = fireEvent.keyDown(window, { key: 'j' });

    expect(notPrevented).toBe(true);
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(PROBE_RUN).not.toHaveBeenCalled();
  });

  it('leaves a chord pressed inside a modal dialog to the dialog', () => {
    const context = hotkeyContext('insert');
    const { container } = render(<Host context={context} />);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const field = document.createElement('textarea');
    dialog.append(field);
    container.append(dialog);

    const notPrevented = fireEvent.keyDown(field, { key: 'Escape' });

    expect(notPrevented).toBe(true);
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('warns in the status window about refused bindings, once per mount', async () => {
    const context = hotkeyContext('insert', true);
    const view = render(<Host context={context} />);

    await waitFor(() => {
      expect(context.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'print',
          windowId: STATUS_WINDOW_ID,
          level: 'warn',
          text: '/blocker: x would block typing in insert mode',
        }),
      );
    });

    view.rerender(<Host context={context} />);

    expect(context.dispatch).toHaveBeenCalledTimes(1);
  });
});

describe(textHandler, () => {
  it('posts the text and prints nothing when the window takes it', async () => {
    const context = fakeCommandContext();

    await textHandler(context)('hello wired');

    expect(context.post).toHaveBeenCalledWith({ text: 'hello wired' });
    expect(context.print).not.toHaveBeenCalled();
  });

  it('prints the window’s refusal as an error', async () => {
    const refusal = "You can't post in this window. Try /home";
    const context = fakeCommandContext({
      post: vi.fn<CommandContext['post']>().mockResolvedValue(refusal),
    });

    await textHandler(context)('hello wired');

    expect(context.print).toHaveBeenCalledWith(refusal, 'error');
  });
});
