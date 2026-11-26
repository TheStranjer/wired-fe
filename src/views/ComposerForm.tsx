/**
 * The composer's form (WFE-125, decision 13): a textarea for the text, a
 * content-warning line and a visibility select, over a live `n/max` character
 * counter that reads error-coloured past the limit, with `[ send ]` beside it
 * and the last failure under it. It is controlled: whoever renders it owns the
 * fields (the composer window keeps them in the app state) and decides what a
 * send does. Ctrl+Enter or the button asks to send, but only while the draft is
 * sendable: text, within the limit, a valid poll if one is open, nothing in
 * flight. The poll editor (./PollSection) needs the instance's poll limits;
 * attachments (WFE-205) go under the text; the compact form (WFE-207) is a DM chat line.
 * The text completes `@handles`, `#tags`, `:emoji:` and `[labels` through the
 * completion it is given (./PostText, WFE-302).
 */
import type { ChangeEvent, JSX, ReactNode } from 'react';

import styles from './Composer.module.css';
import { PollSection } from './PollSection';
import { type PostCompletion, PostText } from './PostText';
import { VisibilitySelect } from './VisibilitySelect';
import type { PollLimits } from '../api/schemas/pollLimits';
import { useT } from '../i18n/I18nProvider';
import type { ComposerFields } from '../state/draft';
import { pollBlocksSend } from '../state/pollEditor';

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
  /** The posting instance's poll limits; given, the form offers the poll editor (WFE-206). */
  readonly pollLimits?: PollLimits;
  /** Controls to show above the text, such as the "Post as" picker. */
  readonly header?: ReactNode;
  /** The chat-style form: one growing line and `[ send ]`, Enter sends. */
  readonly compact?: boolean;
  /** The text gained focus; a window that owns the keyboard mode uses it to leave navigation. */
  readonly onFocus?: () => void;
  /** Controls to show under the text, such as the pane's attachments. */
  readonly attachments?: ReactNode;
  /** The text cannot be typed in (WFE-286), e.g. while what it answers loads. */
  readonly disabled?: boolean;
  /** The hint the empty text shows. */
  readonly placeholder?: string;
  /** What completes the text (WFE-302): the list of suggestions for the word at the caret. */
  readonly completion?: PostCompletion;
};

/** The content-warning line and the audience: what the compact form leaves out. */
function Audience(props: ComposerFormProps): JSX.Element {
  const t = useT();
  return (
    <>
      <input
        aria-label={t('views.composer.content_warning')}
        className={styles['warning']}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          props.onChange({ spoiler: event.target.value });
        }}
        type="text"
        value={props.fields.spoiler}
      />
      <VisibilitySelect
        allowLocal={props.allowLocal}
        fields={props.fields}
        onChange={props.onChange}
      />
    </>
  );
}

/** The row under the text: warning, audience, counter and send. */
function OptionsRow(
  props: ComposerFormProps & { readonly sendable: boolean; readonly send: () => void },
): JSX.Element {
  const t = useT();
  const { text } = props.fields;
  const over = text.length > props.maxCharacters;
  return (
    <div className={styles['options']}>
      {props.compact === true ? null : <Audience {...props} />}
      <span className={over ? styles['countOver'] : styles['count']}>
        {`${String(text.length)}/${String(props.maxCharacters)}`}
      </span>
      <button
        className={styles['send']}
        disabled={!props.sendable}
        onClick={props.send}
        type="button"
      >
        {t('views.composer.send')}
      </button>
    </div>
  );
}

/** The poll toggle and editor, where the form was given poll limits. */
function Poll(props: ComposerFormProps): JSX.Element | null {
  const { pollLimits, fields, onChange } = props;
  return pollLimits === undefined ? null : (
    <PollSection
      limits={pollLimits}
      mediaCount={fields.mediaIds?.length ?? 0}
      onChange={(poll) => {
        onChange({ poll });
      }}
      poll={fields.poll}
    />
  );
}

/** The composer's fields over its options, with the last failure below. */
export function ComposerForm(props: ComposerFormProps): JSX.Element {
  const { text, poll, mediaIds } = props.fields;
  const pollBlocks =
    props.pollLimits !== undefined && pollBlocksSend(poll, mediaIds?.length ?? 0, props.pollLimits);
  const sendable =
    text.trim() !== '' && text.length <= props.maxCharacters && !props.sending && !pollBlocks;
  const send = (): void => {
    if (sendable) {
      props.onSend();
    }
  };
  return (
    <div className={props.compact === true ? styles['compact'] : styles['composer']}>
      {props.header}
      <PostText
        completion={props.completion}
        compact={props.compact === true}
        disabled={props.disabled}
        onFocus={props.onFocus}
        onText={(typed) => {
          props.onChange({ text: typed });
        }}
        placeholder={props.placeholder}
        send={send}
        text={props.fields.text}
      />
      {props.attachments}
      <Poll {...props} />
      <OptionsRow {...props} sendable={sendable} send={send} />
      {props.error === null ? null : (
        <p aria-live="polite" className={styles['error']}>
          {props.error}
        </p>
      )}
    </div>
  );
}
