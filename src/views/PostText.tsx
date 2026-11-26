/**
 * The post text of the composer's form (WFE-125, WFE-207, WFE-302): a
 * textarea where Ctrl+Enter sends, and Enter too when compact, and — when the
 * box is given a {@link PostCompletion} — the suggestion list for the word at
 * its caret, drawn above the box (below it where there is no room above,
 * ./usePopupSide). The textarea is wired to the list as the command line is
 * (aria-controls, aria-activedescendant), but stays a plain textbox. The list
 * never touches Enter: sending is the same whether or not it is open.
 */
import {
  type JSX,
  type KeyboardEvent,
  type RefObject,
  type TextareaHTMLAttributes,
  useRef,
} from 'react';

import styles from './Composer.module.css';
import { useAutoGrow } from './useAutoGrow';
import { usePopupSide } from './usePopupSide';
import { CompletionList, type CompletionRow, rowId } from '../ui/CompletionList';

/**
 * What completes a post's text: the textarea's ref, its key and caret
 * handlers, and the rows of the list (src/keys/useTextCompletion makes one).
 */
export type PostCompletion = {
  readonly ref: RefObject<HTMLTextAreaElement | null>;
  readonly onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly onCaret: (element: HTMLTextAreaElement) => void;
  readonly listId: string;
  readonly rows: readonly CompletionRow[];
  readonly active: number;
};

/** What the text shows and the callbacks it drives. */
type PostTextProps = {
  readonly text: string;
  readonly onText: (text: string) => void;
  /** Send the draft; only asked while it is sendable. */
  readonly send: () => void;
  readonly compact: boolean;
  readonly disabled?: boolean | undefined;
  readonly onFocus?: (() => void) | undefined;
  readonly placeholder?: string | undefined;
  readonly completion?: PostCompletion | undefined;
};

/** The attributes and handlers of a textarea, as far as this module sets them. */
type Attributes = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Whether {@link event} asks to send: Ctrl+Enter, or a bare Enter in the compact form. */
function asksToSend(event: KeyboardEvent<HTMLTextAreaElement>, compact: boolean): boolean {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
    return false;
  }
  return event.ctrlKey || (compact && !event.shiftKey);
}

/** What ties the textarea to {@link completion}'s list: the wiring for assistive tech, and the caret reports. */
function listAttributes(completion: PostCompletion): Attributes {
  const { listId, active } = completion;
  return {
    'aria-activedescendant': active < 0 ? undefined : rowId(listId, active),
    'aria-autocomplete': 'list',
    'aria-controls': listId,
    onClick: (event) => {
      completion.onCaret(event.currentTarget);
    },
    onKeyUp: (event) => {
      completion.onCaret(event.currentTarget);
    },
  };
}

/** The textarea's handlers: edits and keys, over the completion's when there is one. */
function handlers(props: PostTextProps): Attributes {
  const { completion, compact } = props;
  return {
    onChange: (event) => {
      props.onText(event.target.value);
      completion?.onCaret(event.target);
    },
    onKeyDown: (event) => {
      completion?.onKeyDown(event);
      if (!event.defaultPrevented && asksToSend(event, compact)) {
        event.preventDefault();
        props.send();
      }
    },
    ...(completion === undefined ? {} : listAttributes(completion)),
  };
}

/** The suggestion list of {@link completion}. */
function Suggestions(props: { readonly completion: PostCompletion }): JSX.Element {
  const { completion } = props;
  return (
    <CompletionList
      active={completion.active}
      id={completion.listId}
      label="Post suggestions"
      rows={completion.rows}
    />
  );
}

/** The post text: a textarea over its suggestion list. */
export function PostText(props: PostTextProps): JSX.Element {
  const { compact, completion } = props;
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const ref = completion?.ref ?? ownRef;
  useAutoGrow(ref, props.text, compact);
  usePopupSide(fieldRef, completion?.rows.length ?? 0);
  return (
    <div className={compact ? styles['fieldCompact'] : styles['field']} ref={fieldRef}>
      <textarea
        aria-label="Post text"
        className={compact ? styles['textCompact'] : styles['text']}
        disabled={props.disabled}
        onFocus={props.onFocus}
        placeholder={props.placeholder}
        ref={ref}
        rows={compact ? 1 : undefined}
        spellCheck={false}
        value={props.text}
        {...handlers(props)}
      />
      {completion === undefined ? null : <Suggestions completion={completion} />}
    </div>
  );
}
