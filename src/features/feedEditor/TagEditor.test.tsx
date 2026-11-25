/**
 * Tests for the feed editor's hashtags of one account (decision 14): chips
 * for the account's tags alone, a tag added with Enter or `[ add ]` and the box
 * emptied, text that is no tag refused inline, and `[x]` taking a tag off.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { type EditorDraft, draftOf } from './editorDraft';
import { ALICE, LAIN, MAIN } from './editorSession';
import { TagEditor } from './TagEditor';
import type { StoredAccount } from '../../accounts/accountStore';

/** A tag editor of {@link account} over a draft of {@link MAIN} that it changes. */
function Host(props: { readonly account: StoredAccount }): JSX.Element {
  const [draft, setDraft] = useState<EditorDraft>(() => draftOf(MAIN));
  return (
    <>
      <TagEditor account={props.account} draft={draft} onChange={setDraft} />
      <output aria-label="draft">{draft.sources.map((ref) => ref.source).join(' ')}</output>
    </>
  );
}

/** The box that adds a tag as alice. */
function box(): HTMLElement {
  return screen.getByRole('textbox', { name: 'add tag for @alice@wired.example' });
}

describe(TagEditor, () => {
  it('lists the tags of its account as chips', () => {
    render(<Host account={ALICE} />);

    expect(screen.getByRole('list', { name: 'Tags of @alice@wired.example' })).toHaveTextContent(
      '#rust',
    );
  });

  it('has no chips for an account that reads no tags', () => {
    render(<Host account={LAIN} />);

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('adds the tag typed when Enter is pressed, then empties the box', () => {
    render(<Host account={ALICE} />);

    fireEvent.change(box(), { target: { value: '#lisp' } });
    fireEvent.keyDown(box(), { key: 'Enter' });

    expect(screen.getByRole('list')).toHaveTextContent('#lisp');
    expect(box()).toHaveValue('');
    expect(screen.getByLabelText('draft')).toHaveTextContent('home tag:rust tag:lisp');
  });

  it('adds the tag typed when [ add ] is clicked', () => {
    render(<Host account={ALICE} />);

    fireEvent.change(box(), { target: { value: 'lisp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag for @alice@wired.example' }));

    expect(screen.getByRole('list')).toHaveTextContent('#lisp');
  });

  it('adds nothing on another key', () => {
    render(<Host account={ALICE} />);

    fireEvent.change(box(), { target: { value: 'lisp' } });
    fireEvent.keyDown(box(), { key: 'a' });

    expect(screen.getByRole('list')).not.toHaveTextContent('lisp');
    expect(box()).toHaveValue('lisp');
  });

  it('refuses text that is not a tag, keeping it, until a tag is added', () => {
    render(<Host account={ALICE} />);

    fireEvent.change(box(), { target: { value: 'two words' } });
    fireEvent.keyDown(box(), { key: 'Enter' });

    expect(screen.getByRole('alert')).toHaveTextContent('Not a tag: "two words"');
    expect(box()).toHaveValue('two words');

    fireEvent.change(box(), { target: { value: 'words' } });
    fireEvent.keyDown(box(), { key: 'Enter' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('takes a tag off with its [x]', () => {
    render(<Host account={ALICE} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove tag rust of @alice@wired.example' }),
    );

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByLabelText('draft')).toHaveTextContent(/^home$/u);
  });
});
