/**
 * Tests for the prefill chords of the wired hotkeys (AGENTS.md "prefill
 * bindings"): in navigation mode `r` fills `/reply` with the selected post's
 * label and a trailing space, enters insert mode, focuses the command line and
 * leaves the caret behind the text; `t` fills a label-free line with nothing
 * selected; and `r` with nothing selected prints the refusal and changes
 * nothing. The host input is controlled, and the context's `setInput` fills it
 * through its own onChange, as the shell's command line is filled.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import type { ChangeEvent, JSX, RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useHotkeys } from './useHotkeys';
import { buildRegistry } from '../commands/registry';
import type { CommandContext, CommandOutcome, Registry } from '../commands/types';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { EMPTY_BUFFER } from '../state/buffer';
import { addStatuses } from '../state/bufferPosts';
import { selectKey } from '../state/bufferSelection';
import { fakeCommandContext } from '../test/commandContext';
import { status } from '../test/fixtures';
import { STATUS_WINDOW_ID } from '../windows/model';

/** /reply: `r` prefills its line with the selected post's label, `t` without one. */
const REPLY = {
  name: 'reply',
  aliases: [],
  usage: '/reply <label> <text>',
  summary: 'Reply to a post',
  run: async (): Promise<CommandOutcome> => await Promise.resolve({ ok: true }),
  bindings: [
    { mode: 'navigation', chord: 'r', args: '{label}', prefill: true },
    { mode: 'navigation', chord: 't', args: '', prefill: true },
  ],
} as const;

/** The registry of the shipped fixtures; a build failure is a broken test. */
function replyRegistry(): Registry {
  const built = buildRegistry([REPLY]);
  if (!built.ok) {
    throw new Error(built.error);
  }
  return built.value;
}

/** The active window's scrollback: posts one and two labelled a0 and a1, selected or not. */
function stateWithPosts(selected: boolean): AppState {
  const withPosts = addStatuses(EMPTY_BUFFER, [status('two'), status('one')], 'newer');
  const buffer = selected ? selectKey(withPosts, 'post:one') : withPosts;
  return {
    ...initialAppState(),
    mode: 'navigation',
    buffers: new Map([[STATUS_WINDOW_ID, buffer]]),
  };
}

/** The navigation-mode context with a selection only when {@link selected}. */
function prefillContext(selected: boolean): CommandContext {
  return fakeCommandContext({
    state: stateWithPosts(selected),
    registry: replyRegistry(),
    setInput: vi.fn((text: string) => {
      fireEvent.change(commandLine(), { target: { value: text } });
    }),
  });
}

/** Props of the test component {@link Host}. */
type HostProps = {
  readonly context: CommandContext;
};

/** A component that mounts the hook under test over one plain controlled input. */
function Host({ context }: HostProps): JSX.Element {
  const inputRef: RefObject<HTMLInputElement | null> = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  useHotkeys(inputRef, context);

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setValue(event.target.value);
  }

  return <input aria-label="command line" onChange={handleChange} ref={inputRef} value={value} />;
}

/** The command line the host renders, as the input it is. */
function commandLine(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'command line' });
}

/** Mounts the host over {@link context} and returns its blurred command line. */
function mountBlurredHost(context: CommandContext): HTMLInputElement {
  render(<Host context={context} />);
  const input = commandLine();
  input.focus();
  input.blur();
  return input;
}

describe(useHotkeys, () => {
  it('fills the command line with the selected label and enters insert mode', () => {
    const filled = '/reply a0 ';
    const context = prefillContext(true);
    const input = mountBlurredHost(context);

    const prevented = fireEvent.keyDown(window, { key: 'r' });

    expect(prevented).toBe(false);
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'mode', mode: 'insert' });
    expect(input).toHaveValue(filled);
    expect(input).toHaveFocus();
    expect([input.selectionStart, input.selectionEnd]).toStrictEqual([
      filled.length,
      filled.length,
    ]);
  });

  it('fills a label-free line while nothing is selected', () => {
    const context = prefillContext(false);
    const input = mountBlurredHost(context);

    fireEvent.keyDown(window, { key: 't' });

    expect(context.setInput).toHaveBeenCalledWith('/reply ');
    expect(context.print).not.toHaveBeenCalled();
    expect(input).toHaveValue('/reply ');
  });

  it('prints a refusal and changes nothing when the label has no post', () => {
    const context = prefillContext(false);
    const input = mountBlurredHost(context);

    const prevented = fireEvent.keyDown(window, { key: 'r' });

    expect(prevented).toBe(false);
    expect(context.print).toHaveBeenCalledWith('Select a post first (j/k)');
    expect(context.setInput).not.toHaveBeenCalled();
    expect(context.dispatch).not.toHaveBeenCalledWith({ type: 'mode', mode: 'insert' });
    expect(input).not.toHaveFocus();
  });
});
