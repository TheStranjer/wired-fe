/**
 * The words of the confirmation a click on a card's `⋯` → Delete, Block or Mute
 * asks (WFE-266, WFE-267): the title, the message and the confirm label, for one post.
 * Pure: the post's label and view model go in, plain text comes out. The post's
 * body is hostile remote markup, so it only ever appears here as the plain
 * text {@link plainText} flattens it to, cut to {@link EXCERPT_LIMIT}.
 */
import type { PostView } from './postView';
import { plainText } from './quoteView';

/** What a confirmation dialog shows, and which question it asks. */
export type PostConfirmText = {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
};

/** The most characters of the post's words the delete message quotes. */
const EXCERPT_LIMIT = 80;

/** The post's words as one line of at most {@link EXCERPT_LIMIT} characters, `…` marking a cut. */
function excerptOf(contentHtml: string): string {
  const text = plainText(contentHtml);
  return text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT)}…` : text;
}

/** The delete question for the post labelled {@link label}. */
function deleteText(label: string, contentHtml: string): PostConfirmText {
  const excerpt = excerptOf(contentHtml);
  return {
    title: `Delete post [${label}]?`,
    message: excerpt === '' ? "This can't be undone." : `This can't be undone. "${excerpt}"`,
    confirmLabel: 'Delete',
  };
}

/** The block question for the author of the post. */
function blockText(handle: string): PostConfirmText {
  return {
    title: `Block ${handle}?`,
    message:
      "They won't be able to follow or interact with your account, and their posts are hidden from you.",
    confirmLabel: 'Block',
  };
}

/** The mute question for the author of the post; the duration choice sits under it. */
function muteText(handle: string): PostConfirmText {
  return {
    title: `Mute ${handle}?`,
    message: 'Their posts are hidden from you for as long as you choose.',
    confirmLabel: 'Mute',
  };
}

/** The confirmation of {@link kind} on the post labelled {@link label}, as {@link view} shows it. */
export function postConfirmText(
  kind: 'delete' | 'block' | 'mute',
  label: string,
  view: Pick<PostView, 'author' | 'contentHtml'>,
): PostConfirmText {
  switch (kind) {
    case 'delete':
      return deleteText(label, view.contentHtml);
    case 'block':
      return blockText(view.author.fullHandle);
    case 'mute':
      return muteText(view.author.fullHandle);
  }
}
