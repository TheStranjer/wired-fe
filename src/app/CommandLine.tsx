/**
 * The command line wired to the app (AGENTS.md "The command line is the
 * composer"): every submitted line — command or post — goes to the dispatcher
 * (decision 6), which runs it and clears the line when it is done with, and
 * joins the command history the arrow keys walk (./useCommandHistory). Tab
 * completes the word under the caret through ./useCompletion with the
 * providers the composition root passes in. The ref lets the hotkeys move the
 * caret, and focusing the line while navigation is shown switches back to
 * insert. Opening the composer hands it the line's own plain text when the
 * command itself named none (WFE-125).
 */

import { useRef, useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';

import { useCommandContext } from './useCommandContext';
import { useCommandHistory } from './useCommandHistory';
import { useCompletion } from './useCompletion';
import { textHandler, useHotkeys } from './useHotkeys';
import { usePostActionRunner } from './usePostActionRunner';
import type { PostActionRunner } from './usePostActionsApi';
import type { Provider } from '../commands/complete';
import { dispatchInput } from '../commands/dispatch';
import { parseInput } from '../commands/parseInput';
import type { CommandContext } from '../commands/types';
import type { PendingKeys } from '../keys/useGlobalKeys';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { InputLine } from '../ui/InputLine';

/** What the shell gives the command line: completion words, the composer and the pending media. */
export type CommandLineProps = {
  readonly completion: readonly Provider[];
  /** Opens the composer overlay (WFE-125); the app owns the box itself. */
  readonly openComposer: (initialText: string) => void;
  /** The media waiting for the next post (WFE-126); the app owns the list. */
  readonly attachments: CommandContext['attachments'];
  /** The prefix of a key sequence under way (decision 18); the shell shows it in the status line. */
  readonly pendingKeys: PendingKeys;
  /** Hands the app the runner of the post cards' action buttons (WFE-209). */
  readonly registerRunner: (runner: PostActionRunner) => void;
};

/**
 * The text a bare `/compose` takes from the command line: the line's own
 * plain text, so Ctrl+E turns a half-typed post into a draft in the box. A
 * command — or an argument the command already carries — is none of that.
 */
function composerText(initialText: string, line: string): string {
  if (initialText !== '') {
    return initialText;
  }
  const parsed = parseInput(line);
  return parsed.kind === 'text' ? parsed.text : '';
}

/**
 * The composer opener the context carries: Root's opener wrapped so a bare
 * open moves the command line's plain text into the box and empties the line
 * it came from (WFE-125).
 */
function composerOpener(
  open: (initialText: string) => void,
  line: string,
  setValue: (text: string) => void,
): (initialText: string) => void {
  return (initialText: string): void => {
    const moved = composerText(initialText, line);
    if (moved !== initialText) {
      setValue('');
    }
    open(moved);
  };
}

/** The command line and its hotkey, history and completion wiring. */
export function CommandLine(props: CommandLineProps): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [value, setValue] = useState('');
  const lineOpener = composerOpener(props.openComposer, value, setValue);
  const context = useCommandContext(setValue, lineOpener, props.attachments);
  const inputRef = useRef<HTMLInputElement>(null);
  useHotkeys(inputRef, context, props.pendingKeys);
  usePostActionRunner(inputRef, context, props.registerRunner);
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
      onSubmit={(line: string) => {
        void runLine(line);
      }}
      onKeyDown={handleKeyDown}
      inputRef={inputRef}
      onFocus={handleInputFocus}
    />
  );
}
