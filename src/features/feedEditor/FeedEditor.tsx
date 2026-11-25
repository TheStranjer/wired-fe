/**
 * The form of the feed editor (decision 14): the feed's name, the table of
 * accounts by sources, the hashtags of each account and the buttons. It edits a
 * draft, kept here until the reader saves (./useEditorSave), which says what
 * the draft means as `/feed` lines.
 */

import { useState } from 'react';
import type { JSX } from 'react';

import { EditorActions } from './EditorActions';
import { draftOf, toggleSource } from './editorDraft';
import styles from './FeedEditor.module.css';
import { SourceTable } from './SourceTable';
import { TagEditor } from './TagEditor';
import { useEditorSave } from './useEditorSave';
import type { FeedSpec } from '../../state/feeds';
import { useAppState } from '../../state/StateContext';

/** The editor of {@link props.feed} — a new feed when it is null — in the window {@link props.windowId}. */
export function FeedEditor(props: {
  readonly windowId: string;
  readonly feed: FeedSpec | null;
}): JSX.Element {
  const { accounts, expired } = useAppState();
  const [draft, setDraft] = useState(() => draftOf(props.feed));
  const save = useEditorSave({ ...props, draft });
  return (
    <div className={styles['editor']}>
      <label className={styles['field']}>
        <span>Feed name</span>
        <input
          className={styles['input']}
          value={draft.name}
          onChange={(event) => {
            setDraft({ ...draft, name: event.target.value });
          }}
        />
      </label>
      <SourceTable
        accounts={accounts}
        expired={expired}
        draft={draft}
        onToggle={(ref) => {
          setDraft(toggleSource(draft, ref));
        }}
      />
      {accounts.map((account) => (
        <TagEditor key={account.key} account={account} draft={draft} onChange={setDraft} />
      ))}
      <EditorActions save={save} />
    </div>
  );
}
