/**
 * Sending a docked box's draft with the box's own media (WFE-289): the alt text
 * the reader typed on the lines goes to the instance first
 * (./describeMedia), then the window's post handler sends the draft carrying
 * the ids of the ready lines (./composerMedia), and only a post that went
 * through empties the box's media. A refusal at either step is the one message
 * to show, and leaves the media for the retry. The DM and the thread boxes
 * share it, each with its own post handler.
 */

import { draftWithMedia } from './composerMedia';
import { describeMedia } from './describeMedia';
import type { ComposerMedia, Draft } from './draft';
import type { PostContext, WindowKindDefinition } from './windowKind';
import type { WindowState } from '../windows/model';

/** What goes out: the draft, the media of the box it came from, and how the window posts. */
export type MediaPost = {
  readonly draft: Draft;
  readonly media: readonly ComposerMedia[];
  readonly post: NonNullable<WindowKindDefinition['onPost']>;
};

/**
 * Posts {@link what}.draft into {@link win} with its media, after describing
 * them as the window's account. Resolves to the message to show the reader, or
 * to null when the post went through.
 */
export async function postWithMedia(
  context: PostContext,
  win: WindowState,
  what: MediaPost,
): Promise<string | null> {
  const refused = await describeMedia(context, win.ref.accountKey, what.media);
  if (refused !== null) {
    return refused;
  }
  const failure = await what.post(draftWithMedia(what.draft, what.media), win, context);
  if (failure === null) {
    context.dispatch({ type: 'composerMediaClear', windowId: win.id });
  }
  return failure;
}
