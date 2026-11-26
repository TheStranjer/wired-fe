/**
 * The {@link PostContext} of the app layer: what a window kind's post handler
 * may do while it posts. One builder for the command context
 * (./useCommandContext) and the account picker (./useAccountPicker), so a post
 * sent from either behaves alike.
 */

import type { AppState } from '../state/appState';
import type { RefreshDeps } from '../state/refreshSession';
import type { Dispatch } from '../state/StateContext';
import type { PostContext } from '../state/windowKind';

/** The post context over {@link state}, stamping with the current moment. */
export function buildPostContext(
  state: AppState,
  dispatch: Dispatch,
  refresh: RefreshDeps,
): PostContext {
  return { state, dispatch, now: () => new Date(), refresh };
}
