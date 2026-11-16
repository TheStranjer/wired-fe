/**
 * The command line wired to the app (AGENTS.md "The command line is the
 * composer"): every submitted line — command or post — goes to the dispatcher
 * (decision 6), which runs it and clears the line when it is done with, and
 * joins the command history the arrow keys walk (./useCommandHistory). Tab
 * completes the word under the caret through ./useCompletion with the
 * providers the composition root passes in. The ref lets the hotkeys move the
 * caret, and focusing the line while navigation is shown switches back to
 * insert.
 */

import { useRef, useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';

import { useCommandContext } from './useCommandContext';
import { useCommandHistory } from './useCommandHistory';
import { useCompletion } from './useCompletion';
import { textHandler, useHotkeys } from './useHotkeys';
import type { Provider } from '../commands/complete';
import { dispatchInput } from '../commands/dispatch';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { InputLine } from '../ui/InputLine';

/** The words Tab may complete to, in provider order; built by ./Root. */
export type CommandLineProps = {
  readonly completion: readonly Provider[];
};

/** The command line and its hotkey, history and completion wiring. */
export function CommandLine(props: CommandLineProps): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [value, setValue] = useState('');
  const context = useCommandContext(setValue);
  const inputRef = useRef<HTMLInputElement>(null);
  useHotkeys(inputRef, context);
  const history = useCommandHistory(state.mode, value, setValue);
  const completion = useCompletion({
    inputRef,
    mode: state.mode,
    providers: props.completion,
    value,
    setValue,
  });

  /** Do what one submitted line asks — command or post — then clear the line. */
  async function runLine(line: string): Promise<void> {
    history.remember(line);
    await dispatchInput(line, context, textHandler(context));
    setValue('');
  }

  function submitLine(line: string): void {
    void runLine(line);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    completion(event);
    history.onKeyDown(event);
  }

  function handleInputFocus(): void {
    if (state.mode === 'navigation') {
      dispatch({ type: 'mode', mode: 'insert' });
    }
  }

  return (
    <InputLine
      prompt=">"
      value={value}
      onChange={setValue}
      onSubmit={submitLine}
      onKeyDown={handleKeyDown}
      inputRef={inputRef}
      onFocus={handleInputFocus}
    />
  );
}
