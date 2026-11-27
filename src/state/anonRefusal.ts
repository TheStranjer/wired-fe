/**
 * What a signed-out read hears when the instance turns it down (WFE-340): a
 * 401 or 403 on a call made under an `anon:<origin>` key (./anonAccount) means
 * the backend does not show that read to visitors. The call site reports it
 * with `anonRefused`; the app layer (src/app/useAnonFallback) closes the
 * origin's signed-out windows, says so and puts the link back in the address
 * bar, then answers with `anonHandled` so the next visit can ask again.
 */

import type { AppState } from './appState';

/** The two actions that carry a refusal to the app layer and clear it again. */
export type AnonRefusalAction =
  | { readonly type: 'anonRefused'; readonly accountKey: string }
  | { readonly type: 'anonHandled'; readonly accountKey: string };

/** {@link state} with the refusal of {@link action} recorded or cleared; the same state when it changes nothing. */
export function anonRefusalReducer(state: AppState, action: AnonRefusalAction): AppState {
  const has = state.anonRefused.has(action.accountKey);
  if (has === (action.type === 'anonRefused')) {
    return state;
  }
  const anonRefused = new Set(state.anonRefused);
  if (has) {
    anonRefused.delete(action.accountKey);
  } else {
    anonRefused.add(action.accountKey);
  }
  return { ...state, anonRefused };
}
