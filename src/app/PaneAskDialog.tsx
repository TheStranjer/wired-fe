/**
 * The dialog a pane menu's asking rows open (WFE-269): `Hashtag…`, `Search…`,
 * `Profile…` and `DM…` ask for their one argument here instead of leaving a
 * half-written line in the command line. The suggestions are the command
 * line's own completion words (src/views/completionProviders): the handles
 * the windows have shown for accounts, the tags they carry for hashtags,
 * nothing for a search. This is the app-layer seam that keeps the
 * presentational {@link PromptDialog} free of state.
 */
import { useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';

import type { PaneAsk } from './paneAsk';
import type { AppState } from '../state/appState';
import { useAppState } from '../state/StateContext';
import { PromptDialog } from '../ui/PromptDialog';
import { handleProvider, tagProvider } from '../views/completionProviders';

/** The word whose completions {@link value} asks for: it starts with the prefix of {@link suggest}. */
function wordFor(suggest: 'accounts' | 'tags', value: string): string {
  const prefix = suggest === 'accounts' ? '@' : '#';
  const typed = value.trim();
  return typed.startsWith(prefix) ? typed : `${prefix}${typed}`;
}

/** The completion words for {@link value} in the style of {@link suggest}; none for plain text. */
function suggestionsFor(
  state: AppState,
  suggest: PaneAsk['suggest'],
  value: string,
): readonly string[] {
  if (suggest === null) {
    return [];
  }
  const provider = suggest === 'accounts' ? handleProvider(state) : tagProvider(state);
  return provider.candidates(wordFor(suggest, value));
}

/** What the dialog is told about its row. */
type PaneAskDialogProps = {
  readonly ask: PaneAsk;
  /** The menu's verb, e.g. `Pop out`, which labels the field. */
  readonly verb: string;
  readonly onSubmit: (answer: string) => void;
  readonly onCancel: () => void;
};

/** The dialog asking for the argument of {@link PaneAskDialogProps.ask}, with its suggestions. */
export function PaneAskDialog(props: PaneAskDialogProps): JSX.Element {
  const { ask, verb, onSubmit, onCancel } = props;
  const state = useAppState();
  const [value, setValue] = useState('');
  return createPortal(
    <PromptDialog
      field={verb}
      onCancel={onCancel}
      onChange={setValue}
      onSubmit={onSubmit}
      placeholder={ask.placeholder}
      suggestions={suggestionsFor(state, ask.suggest, value)}
      title={ask.title}
    />,
    document.body,
  );
}
