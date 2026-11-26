/**
 * Completion on the command line as the user sees it (WFE-124, WFE-297,
 * WFE-300): Tab through ./useCompletion, and the live list of suggestions
 * under the line that narrows as the word at the caret is typed. The list
 * shows while the keyboard is in insert mode and the caret is in a word one
 * of the providers (./useCompletionProviders) accepts and describes — a
 * command, an `@handle`, a `#tag` or an `:emoji:` — and while the caret is in
 * an `@handle` the instance is asked for more accounts after a pause
 * (../views/useHandleSearch). It follows a Tab completion in progress (so it
 * stays up while Tab cycles, with the row of the candidate in the line
 * highlighted) and ends with it. A click on a row completes to it the way Tab
 * would, without the input losing focus. The hook answers with what the
 * command line gives its input.
 */

import { useState } from 'react';
import type { JSX } from 'react';

import {
  type CompletionKeyDown,
  type CompletionLine,
  type Showing,
  useCompletion,
  usePendingCaret,
} from './useCompletion';
import { useCompletionProviders } from './useCompletionProviders';
import { type SuggestionView, suggestionView } from '../commands/suggest';
import { CompletionList, type CompletionRow, rowId } from '../ui/CompletionList';
import type { InputLineProps } from '../ui/InputLine';
import { handleWordAt, useHandleSearch } from '../views/useHandleSearch';

/** The element id of the suggestion listbox: the app has one command line. */
const LIST_ID = 'command-suggestions';

/** What the command line wires through: the key handler and the props of its input. */
type CommandCompletion = {
  readonly onKeyDown: CompletionKeyDown;
  readonly input: Pick<InputLineProps, 'onCaret' | 'listId' | 'expanded' | 'activeId' | 'popup'>;
};

/**
 * The line the hook steers: what ./useCompletion steers, minus what this hook
 * hears itself and the providers, which it builds for the word at the caret.
 */
type CommandCompletionLine = Omit<CompletionLine, 'onShown' | 'providers'>;

/** The list drawn for {@link view}, whose rows complete the line through {@link pick}. */
function listOf(
  view: SuggestionView | null,
  pick: (completed: ReturnType<SuggestionView['pick']>) => void,
): JSX.Element {
  const rows: readonly CompletionRow[] =
    view === null
      ? []
      : view.rows.map((row) => ({
          label: row.label,
          description: row.description,
          image: row.image,
          detail: row.detail,
          pick: () => {
            pick(view.pick(row.word));
          },
        }));
  return (
    <CompletionList
      active={view?.active ?? -1}
      id={LIST_ID}
      label="Command suggestions"
      rows={rows}
    />
  );
}

/** Steer {@link line} with Tab and draw the suggestion list for it. */
export function useCommandCompletion(line: CommandCompletionLine): CommandCompletion {
  const { inputRef, mode, value, setValue } = line;
  const [shown, setShown] = useState<Showing | null>(null);
  const [caret, setCaret] = useState(0);
  const placer = usePendingCaret(inputRef);
  const searched = useHandleSearch(handleWordAt(value, caret));
  const providers = useCompletionProviders(searched);
  const onKeyDown = useCompletion({ ...line, providers, onShown: setShown });
  const completing = shown !== null && shown.text === value ? shown.state : null;
  const at = { text: value, cursor: caret };
  const view = mode === 'insert' ? suggestionView(at, providers, completing) : null;

  function complete(completed: ReturnType<SuggestionView['pick']>): void {
    placer.place(completed.text, completed.cursor);
    setValue(completed.text);
    setCaret(completed.cursor);
    placer.focus();
  }

  return {
    onKeyDown,
    input: {
      onCaret: (input) => {
        setCaret(Number(input.selectionStart));
      },
      listId: LIST_ID,
      expanded: view !== null,
      activeId: view === null || view.active < 0 ? undefined : rowId(LIST_ID, view.active),
      popup: listOf(view, complete),
    },
  };
}
