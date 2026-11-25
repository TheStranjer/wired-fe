/**
 * The confirmation behind a card's `⋯` → Delete, Block and Mute rows (WFE-266,
 * WFE-267): a line the registry marked `confirm` opens a
 * {@link PostConfirmDialog} instead of running; confirming runs that line (a
 * mute with the chosen duration on the end, never as a prefill) and cancelling
 * runs nothing. Every other line goes straight to the app's runner. Whether
 * the dialog is open lives here, in the views layer, so the ui stays
 * presentational. The dialog is portalled to the body: it must not sit inside
 * the scrollback's live log region.
 */
import { useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';

import type { PostActions } from './PostActionsContext';
import { PostConfirmDialog } from './PostConfirmDialog';
import { postConfirmText, type PostConfirmText } from './postConfirmText';
import type { PostView } from './postView';
import type { PostActionLine } from '../ui/postActionTypes';

/** A line waiting for its answer, which question it is, and the words of it. */
type Pending = {
  readonly line: string;
  readonly kind: 'delete' | 'block' | 'mute';
  readonly text: PostConfirmText;
};

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
    const kind = action.confirm;
    setPending({ line: action.line, kind, text: postConfirmText(kind, label, view) });
  };
  if (pending === null) {
    return { onAction, dialog: null };
  }
  const dialog = createPortal(
    <PostConfirmDialog
      kind={pending.kind}
      line={pending.line}
      onCancel={() => {
        setPending(null);
      }}
      onRun={(line) => {
        setPending(null);
        actions.run({ line, prefill: false });
      }}
      text={pending.text}
    />,
    document.body,
  );
  return { onAction, dialog };
}
