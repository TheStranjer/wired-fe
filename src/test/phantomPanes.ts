/**
 * A desktop for the pane title-bar tests (WFE-228, WFE-229): two panes side by
 * side, each showing a window of a kind no feature implements, so the panes
 * render a frame and nothing else.
 */
import { type AppState, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { windowId } from '../windows/model';
import type { WindowKind, WindowRef } from '../windows/model';

/** A window of a kind no shipped feature implements, named by `target`. */
function phantom(target: string): WindowRef {
  return { kind: 'phantom' as unknown as WindowKind, accountKey: null, target };
}

/** `phantom/a` and `phantom/b` side by side, with b focused. */
export function twoPanes(): AppState {
  const open = (state: AppState, target: string): AppState =>
    appReducer(state, {
      type: 'windows',
      action: { type: 'open', ref: phantom(target), title: `phantom/${target}` },
    });
  const both = open(open(initialAppState(), 'a'), 'b');
  const back = appReducer(both, {
    type: 'windows',
    action: { type: 'activate', id: windowId(phantom('a')) },
  });
  return appReducer(back, {
    type: 'layout',
    action: { type: 'split', dir: 'row', windowId: windowId(phantom('b')) },
  });
}
