/**
 * The confirmation behind a card's `⋯` → Delete and Block rows (WFE-266): a
 * line the registry marked `confirm` opens a {@link ConfirmDialog} instead of
 * running; confirming runs that same line (never as a prefill) and cancelling
 * runs nothing. Every other line goes straight to the app's runner. Whether
 * the dialog is open lives here, in the views layer, so the ui stays
 * presentational. The dialog is portalled to the body: it must not sit inside
 * the scrollback's live log region.
 */
import { useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';

import type { PostActions } from './PostActionsContext';
import { postConfirmText, type PostConfirmText } from './postConfirmText';
import type { PostView } from './postView';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { PostActionLine } from '../ui/postActionTypes';

/** A line waiting for its answer, and the words of the question. */
type Pending = { readonly line: string; readonly text: PostConfirmText };

/** What a card needs: the handler for its action bar and the dialog to render, if any. */
export type PostConfirm = {
  readonly onAction: (line: PostActionLine) => void;
  readonly dialog: JSX.Element | null;
};

/** The action handler of the card labelled {@link label}, and its confirm dialog while one is open. */
export function usePostConfirm(
  actions: PostActions,
  label: string,
  view: Pick<PostView, 'author' | 'contentHtml'>,
): PostConfirm {
  const [pending, setPending] = useState<Pending | null>(null);
  const onAction = (action: PostActionLine): void => {
    if (action.confirm === undefined) {
      actions.run(action);
      return;
    }
    setPending({ line: action.line, text: postConfirmText(action.confirm, label, view) });
  };
  if (pending === null) {
    return { onAction, dialog: null };
  }
  const dialog = createPortal(
    <ConfirmDialog
      confirmLabel={pending.text.confirmLabel}
      danger
      message={pending.text.message}
      onCancel={() => {
        setPending(null);
      }}
      onConfirm={() => {
        setPending(null);
        actions.run({ line: pending.line, prefill: false });
      }}
      title={pending.text.title}
    />,
    document.body,
  );
  return { onAction, dialog };
}
