/**
 * The seam between a post card's action bar and the command line (decision 6,
 * WFE-209): the composition root provides the command lines a card's buttons
 * run, taken from the registry, and the way to run one, so the views never
 * import the commands. Without a provider no card has an action and nothing
 * runs.
 */

import { createContext, use } from 'react';
import type { JSX, ReactNode } from 'react';

import type { PostActionLine, PostActionLines } from '../ui/postActionTypes';

/** What the app lends a card: its lines for one post label, and a way to run one. */
export type PostActions = {
  /** The line each command runs on the post labelled `label`. */
  readonly linesFor: (label: string) => PostActionLines;
  /** Run one line as the command line would, or fill it in for the user. */
  readonly run: (line: PostActionLine) => void;
};

/** The actions of a tree with no provider: no commands, and running does nothing. */
const NO_ACTIONS: PostActions = { linesFor: () => ({}), run: () => undefined };

const PostActionsContext = createContext<PostActions>(NO_ACTIONS);

/** Put {@link actions} in front of {@link children}. */
export function PostActionsProvider(props: {
  readonly actions: PostActions;
  readonly children: ReactNode;
}): JSX.Element {
  return <PostActionsContext value={props.actions}>{props.children}</PostActionsContext>;
}

/** The post actions the app lends, or the empty ones. */
export function usePostActions(): PostActions {
  return use(PostActionsContext);
}
