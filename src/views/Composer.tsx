/**
 * The composer overlay for long posts (WFE-125): a textarea for the text,
 * a content-warning line and a visibility select, over a live `n/max`
 * character counter that reads error-coloured past the limit. Ctrl+Enter or
 * the `[ send ]` button hands the draft to `onSubmit`; an error string comes
 * back shown inside the box, and success closes it. Posting itself, the
 * capabilities behind the limit and the local audience, and what closing
 * means all belong to the app layer that renders it.
 */
import { useState } from 'react';
import type { ChangeEvent, JSX, KeyboardEvent } from 'react';

import styles from './Composer.module.css';
import type { Visibility } from '../api/schemas/status';
import type { Draft } from '../state/draft';

/** What the composer shows and the callbacks it drives. */
export type ComposerProps = {
  /** The text the box opens with (the command line's, or `/compose`'s argument). */
  readonly initialText: string;
  /** The active account's post length; the counter turns red past it. */
  readonly maxCharacters: number;
  /** Whether the instance serves local-only posts (decision 5). */
  readonly allowLocal: boolean;
  /** The audience a send names while the user changes nothing. */
  readonly defaultVisibility: Visibility;
  /** Post the draft; resolves to an error message to show, or null to close. */
  readonly onSubmit: (draft: Draft) => Promise<string | null>;
  /** Close the box without sending (Escape, and success). */
  readonly onClose: () => void;
};

/** The draft the fields stand for: the warning is dropped when empty. */
function buildDraft(text: string, spoiler: string, visibility: Visibility): Draft {
  return {
    text,
    ...(spoiler === '' ? {} : { spoilerText: spoiler }),
    visibility,
  };
}

/** What a send answered: its error string, a throw's message, or null for success. */
async function submitted(submit: ComposerProps['onSubmit'], draft: Draft): Promise<string | null> {
  try {
    return await submit(draft);
  } catch (thrown: unknown) {
    return thrown instanceof Error ? thrown.message : String(thrown);
  }
}

/** The composer's own state: the fields, the counter and sending (WFE-125). */
function useDraft(props: ComposerProps) {
  const [text, setText] = useState(props.initialText);
  const [spoiler, setSpoiler] = useState('');
  const [visibility, setVisibility] = useState<Visibility>(props.defaultVisibility);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const over = text.length > props.maxCharacters;
  const sendable = text.trim() !== '' && !over && !sending;

  /** Hand the draft over: close on success, keep the text and show the failure. */
  async function send(): Promise<void> {
    if (!sendable) {
      return;
    }
    setSending(true);
    const failure = await submitted(props.onSubmit, buildDraft(text, spoiler, visibility));
    if (failure === null) {
      props.onClose();
      return;
    }
    setSending(false);
    setError(failure);
  }

  return {
    text,
    setText,
    spoiler,
    setSpoiler,
    visibility,
    setVisibility,
    error,
    over,
    sendable,
    send,
  };
}

/** The composer's fields and send, as {@link useDraft} keeps them. */
type DraftState = ReturnType<typeof useDraft>;

/** Props of the box's regions, all sharing one {@link DraftState}. */
type PartProps = {
  readonly draft: DraftState;
  readonly allowLocal: boolean;
  readonly maxCharacters: number;
};

/** The post text: a textarea where Ctrl+Enter sends. */
function PostText({ draft }: PartProps): JSX.Element {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      void draft.send();
    }
  }

  return (
    <textarea
      aria-label="Post text"
      className={styles['text']}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
        draft.setText(event.target.value);
      }}
      onKeyDown={handleKeyDown}
      spellCheck={false}
      value={draft.text}
    />
  );
}

/** The audiences the select offers, in order; `local` last, when served. */
const BASE_VISIBILITIES: readonly Visibility[] = ['public', 'unlisted', 'private', 'direct'];

/** The visibility choices for one instance. */
function choices(allowLocal: boolean): readonly Visibility[] {
  return allowLocal ? [...BASE_VISIBILITIES, 'local'] : BASE_VISIBILITIES;
}

/** Who may see the post, one select; a change it cannot name changes nothing. */
function VisibilitySelect({ allowLocal, draft }: PartProps): JSX.Element {
  return (
    <select
      aria-label="Visibility"
      className={styles['select']}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        const chosen = choices(allowLocal).find((name) => name === value);
        if (chosen !== undefined) {
          draft.setVisibility(chosen);
        }
      }}
      value={draft.visibility}
    >
      {choices(allowLocal).map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

/** The row under the text: warning, audience, counter and send. */
function OptionsRow({ allowLocal, draft, maxCharacters }: PartProps): JSX.Element {
  const count = `${String(draft.text.length)}/${String(maxCharacters)}`;
  return (
    <div className={styles['options']}>
      <input
        aria-label="Content warning"
        className={styles['warning']}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          draft.setSpoiler(event.target.value);
        }}
        type="text"
        value={draft.spoiler}
      />
      <VisibilitySelect allowLocal={allowLocal} draft={draft} maxCharacters={maxCharacters} />
      <span className={draft.over ? styles['countOver'] : styles['count']}>{count}</span>
      <button
        className={styles['send']}
        disabled={!draft.sendable}
        onClick={() => {
          void draft.send();
        }}
        type="button"
      >
        [ send ]
      </button>
    </div>
  );
}

/** The long-post box: text over its options, with the last failure below. */
export function Composer(props: ComposerProps): JSX.Element {
  const draft = useDraft(props);
  return (
    <div className={styles['composer']}>
      <PostText allowLocal={props.allowLocal} draft={draft} maxCharacters={props.maxCharacters} />
      <OptionsRow allowLocal={props.allowLocal} draft={draft} maxCharacters={props.maxCharacters} />
      {draft.error === null ? null : (
        <p aria-live="polite" className={styles['error']}>
          {draft.error}
        </p>
      )}
    </div>
  );
}
