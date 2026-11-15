/**
 * The command line's submitted-line history (see ./CommandLine), as a hook:
 * one History in state that lives as long as the caller, an onKeyDown for the
 * input that walks it with plain ArrowUp/ArrowDown while insert mode is shown,
 * and a remember for every submitted line. Nothing persists across reloads.
 */

import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import {
  type History,
  EMPTY_HISTORY,
  historyDown,
  historyUp,
  pushHistory,
} from '../commands/history';
import type { InputMode } from '../keys/mode';

/** The history's two seams: record a submit, steer the arrows. */
type CommandHistory = {
  /** Hand to the command line's onKeyDown; recalled text lands through setValue. */
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Call with every submitted line; blank lines and repeats record nothing. */
  readonly remember: (line: string) => void;
};

/** True when {@link event} carries a modifier: those arrows belong to the keymap. */
function hasModifier(event: KeyboardEvent<HTMLInputElement>): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

/**
 * The command history of one command line: {@link remember} records submitted
 * lines, {@link onKeyDown} walks them while {@link mode} is insert and leaves
 * every other key alone, and the text it recalls reaches the line through
 * {@link setValue}. The draft the arrows return to is the line's {@link value}
 * when browsing begins.
 */
export function useCommandHistory(
  mode: InputMode,
  value: string,
  setValue: (text: string) => void,
): CommandHistory {
  const [history, setHistory] = useState(EMPTY_HISTORY);

  /** Show the recalled line and remember where the browsing cursor stands. */
  function recall([next, text]: [History, string]): void {
    setHistory(next);
    setValue(text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (mode !== 'insert' || hasModifier(event)) {
      return;
    }
    if (event.key === 'ArrowUp') {
      recall(historyUp(history, value));
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      recall(historyDown(history));
      event.preventDefault();
    }
  }

  function remember(line: string): void {
    setHistory(pushHistory(history, line));
  }

  return { onKeyDown, remember };
}
