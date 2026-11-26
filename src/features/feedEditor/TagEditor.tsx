/**
 * The feed editor's hashtags of one account (decision 14): an "add tag" box
 * and a list of chips, each chip a hashtag the feed reads as the account with
 * an `[x]` that stops reading it. Text that is not a tag name is refused where
 * it was typed.
 */

import { useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';

import { type EditorDraft, tagsOf, toggleSource, withTag } from './editorDraft';
import styles from './FeedEditor.module.css';
import type { StoredAccount } from '../../accounts/accountStore';
import { useT } from '../../i18n/I18nProvider';

/** What the tag editor of one account shows and does. */
type TagEditorProps = {
  readonly account: StoredAccount;
  readonly draft: EditorDraft;
  /** The draft the reader's change makes of it. */
  readonly onChange: (draft: EditorDraft) => void;
};

/** The chips of the hashtags the draft reads as the account, each with its `[x]`. */
function TagChips(props: TagEditorProps): JSX.Element {
  const { account, draft } = props;
  const t = useT();
  return (
    <ul
      className={styles['chips']}
      aria-label={t('features.feed_editor.tags_label', { handle: account.handle })}
    >
      {tagsOf(draft, account.key).map((tag) => (
        <li key={tag}>
          {`#${tag} `}
          <button
            type="button"
            className={styles['button']}
            aria-label={t('features.feed_editor.remove_tag', { tag, handle: account.handle })}
            onClick={() => {
              props.onChange(
                toggleSource(draft, { accountKey: account.key, source: `tag:${tag}` }),
              );
            }}
          >
            [x]
          </button>
        </li>
      ))}
    </ul>
  );
}

/** What the box that adds a tag holds and does. */
type TagInput = {
  readonly text: string;
  readonly error: string | null;
  readonly setText: (text: string) => void;
  /** Add the typed tag to the draft, or say why it is not one. */
  readonly add: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

/** The state of the box that adds a tag as the account to the draft. */
function useTagInput(props: TagEditorProps): TagInput {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = (): void => {
    const next = withTag(props.draft, props.account.key, text);
    setError(next.ok ? null : next.error);
    if (next.ok) {
      props.onChange(next.value);
      setText('');
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      add();
    }
  };
  return { text, error, setText, add, onKeyDown };
}

/** The hashtags of one account, with the box that adds one. */
export function TagEditor(props: TagEditorProps): JSX.Element {
  const { handle } = props.account;
  const input = useTagInput(props);
  const t = useT();
  return (
    <div className={styles['tagRow']}>
      <label className={styles['field']}>
        <span>{`@${handle}`}</span>
        <input
          className={styles['input']}
          aria-label={t('features.feed_editor.add_label', { handle })}
          placeholder={t('features.feed_editor.add_placeholder')}
          value={input.text}
          onChange={(event) => {
            input.setText(event.target.value);
          }}
          onKeyDown={input.onKeyDown}
        />
      </label>
      <button
        type="button"
        className={styles['button']}
        aria-label={t('features.feed_editor.add_button_label', { handle })}
        onClick={input.add}
      >
        {t('features.feed_editor.add_button')}
      </button>
      <TagChips account={props.account} draft={props.draft} onChange={props.onChange} />
      {input.error === null ? null : (
        <p className={styles['error']} role="alert">
          {input.error}
        </p>
      )}
    </div>
  );
}
