/**
 * The composer's form (WFE-125, decision 13): a textarea for the text, a
 * content-warning line and a visibility select, over a live `n/max` character
 * counter that reads error-coloured past the limit, with `[ send ]` beside it
 * and the last failure under it. It is controlled: whoever renders it owns the
 * fields — the overlay in local state (./Composer), the composer window in the
 * app state — and decides what a send does, so both show exactly the same
 * thing. Ctrl+Enter or the button asks to send, but only while the draft is
 * sendable: text, within the limit, nothing in flight.
 */
import type { ChangeEvent, JSX, KeyboardEvent, ReactNode } from 'react';

import styles from './Composer.module.css';
import type { Visibility } from '../api/schemas/status';
import type { ComposerFields } from '../state/draft';

/** What the form shows and the callbacks it drives. */
export type ComposerFormProps = {
  readonly fields: ComposerFields;
  /** The posting account's post length; the counter turns red past it. */
  readonly maxCharacters: number;
  /** Whether the instance serves local-only posts (decision 5). */
  readonly allowLocal: boolean;
  /** A send is in flight: sending again waits. */
  readonly sending: boolean;
  /** The last failure to show under the form; null shows none. */
  readonly error: string | null;
  /** Change some of the fields. */
  readonly onChange: (patch: Partial<ComposerFields>) => void;
  /** Send the draft; only asked while it is sendable. */
  readonly onSend: () => void;
  /** Controls to show above the text, such as the "Post as" picker. */
  readonly header?: ReactNode;
};

/** The audiences the select offers, in order; `local` last, when served. */
const BASE_VISIBILITIES: readonly Visibility[] = ['public', 'unlisted', 'private', 'direct'];

/** The visibility choices for one instance. */
function choices(allowLocal: boolean): readonly Visibility[] {
  return allowLocal ? [...BASE_VISIBILITIES, 'local'] : BASE_VISIBILITIES;
}

/** Who may see the post, one select; a change it cannot name changes nothing. */
function VisibilitySelect(props: ComposerFormProps): JSX.Element {
  return (
    <select
      aria-label="Visibility"
      className={styles['select']}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        const chosen = choices(props.allowLocal).find((name) => name === value);
        if (chosen !== undefined) {
          props.onChange({ visibility: chosen });
        }
      }}
      value={props.fields.visibility}
    >
      {choices(props.allowLocal).map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

/** The post text: a textarea where Ctrl+Enter sends. */
function PostText(props: ComposerFormProps & { readonly send: () => void }): JSX.Element {
  return (
    <textarea
      aria-label="Post text"
      className={styles['text']}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
        props.onChange({ text: event.target.value });
      }}
      onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.ctrlKey && event.key === 'Enter') {
          event.preventDefault();
          props.send();
        }
      }}
      spellCheck={false}
      value={props.fields.text}
    />
  );
}

/** The row under the text: warning, audience, counter and send. */
function OptionsRow(
  props: ComposerFormProps & { readonly sendable: boolean; readonly send: () => void },
): JSX.Element {
  const { text, spoiler } = props.fields;
  const over = text.length > props.maxCharacters;
  return (
    <div className={styles['options']}>
      <input
        aria-label="Content warning"
        className={styles['warning']}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          props.onChange({ spoiler: event.target.value });
        }}
        type="text"
        value={spoiler}
      />
      <VisibilitySelect {...props} />
      <span className={over ? styles['countOver'] : styles['count']}>
        {`${String(text.length)}/${String(props.maxCharacters)}`}
      </span>
      <button
        className={styles['send']}
        disabled={!props.sendable}
        onClick={props.send}
        type="button"
      >
        [ send ]
      </button>
    </div>
  );
}

/** The composer's fields over its options, with the last failure below. */
export function ComposerForm(props: ComposerFormProps): JSX.Element {
  const { text } = props.fields;
  const sendable = text.trim() !== '' && text.length <= props.maxCharacters && !props.sending;
  const send = (): void => {
    if (sendable) {
      props.onSend();
    }
  };
  return (
    <div className={styles['composer']}>
      {props.header}
      <PostText {...props} send={send} />
      <OptionsRow {...props} sendable={sendable} send={send} />
      {props.error === null ? null : (
        <p aria-live="polite" className={styles['error']}>
          {props.error}
        </p>
      )}
    </div>
  );
}
