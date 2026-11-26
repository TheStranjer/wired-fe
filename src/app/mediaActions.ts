/**
 * What the reader can do to the command line's pending media lines (WFE-287):
 * empty them, set the alt text of one, take one off. Each is one action on the
 * command line's slice of the composers' media (src/state/composerMedia).
 */

import { COMMAND_LINE_MEDIA } from '../state/composerMedia';
import type { Dispatch } from '../state/StateContext';

/** The ways to change the pending media lines. */
export type MediaActions = {
  /** Drops every line; the next post that goes through takes the ids with it. */
  readonly clear: () => void;
  /** Sets the alt text of line {@link key}. */
  readonly describe: (key: string, description: string) => void;
  /** Takes line {@link key} off the next post. */
  readonly remove: (key: string) => void;
};

/** The {@link MediaActions} that dispatch into {@link dispatch}. */
export function mediaActions(dispatch: Dispatch): MediaActions {
  const windowId = COMMAND_LINE_MEDIA;
  return {
    clear: () => {
      dispatch({ type: 'composerMediaClear', windowId });
    },
    describe: (key, description) => {
      dispatch({ type: 'composerMediaPatch', windowId, key, patch: { description } });
    },
    remove: (key) => {
      dispatch({ type: 'composerMediaRemove', windowId, key });
    },
  };
}
