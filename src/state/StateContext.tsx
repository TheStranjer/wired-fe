/**
 * The React context over the pure app state (AGENTS.md "Layout": src/state is
 * the pure app state — windows, line buffers, accounts, settings — and the
 * React context is what puts it in front of the shell). One provider runs the
 * one reducer of ./reducer; the shell's commands, hotkeys and clicks all ask
 * for their transitions through the dispatch it hands down. State and dispatch
 * travel in two separate contexts, so a component that only ever acts does not
 * re-render when a scrollback moves. Reading either outside the provider
 * throws: that is a programming error, not a state the application can hold.
 */

import { createContext, use, useReducer, type JSX, type ReactNode } from 'react';

import { type AppState, initialAppState } from './appState';
import { appReducer, type AppAction } from './reducer';

/** Ask the application's one reducer for a transition. */
export type Dispatch = (action: AppAction) => void;

/** The whole app state; null where no provider has put one. */
const AppStateContext = createContext<AppState | null>(null);

/** The one dispatch; null where no provider has put one. */
const AppDispatchContext = createContext<Dispatch | null>(null);

/**
 * Hold the app state in the one reducer of ./reducer, from {@link initial} or
 * a fresh {@link initialAppState}, and hand state and dispatch down as two
 * contexts so dispatch-only consumers do not re-render on state changes.
 */
export function AppStateProvider(props: {
  readonly initial?: AppState;
  readonly children: ReactNode;
}): JSX.Element {
  const { initial, children } = props;
  const [state, dispatch] = useReducer(appReducer, initial ?? initialAppState());
  return (
    <AppStateContext value={state}>
      <AppDispatchContext value={dispatch}>{children}</AppDispatchContext>
    </AppStateContext>
  );
}

/** The whole app state; throws outside an {@link AppStateProvider}. */
export function useAppState(): AppState {
  const state = use(AppStateContext);
  if (state === null) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }
  return state;
}

/** The application's one dispatch; throws outside an {@link AppStateProvider}. */
export function useAppDispatch(): Dispatch {
  const dispatch = use(AppDispatchContext);
  if (dispatch === null) {
    throw new Error('useAppDispatch must be used inside AppStateProvider');
  }
  return dispatch;
}
