/**
 * The session scaffolding shared by the app layer's context and attachment
 * tests (WFE-126): a fresh initialAppState moved along by a list of actions,
 * and the provider wrapper that seeds a hook or component with it. Purely
 * test wiring; no assertion lives here.
 */
import type { JSX, ReactNode } from 'react';

import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';

/** A fresh session moved along by {@link actions}. */
export function stateAfter(actions: readonly AppAction[]): AppState {
  return actions.reduce(appReducer, initialAppState());
}

/** The provider wrapper that seeds the hook under test with {@link actions}. */
export function seeded(actions: readonly AppAction[]) {
  return function Wrapper({ children }: { readonly children: ReactNode }): JSX.Element {
    return <AppStateProvider initial={stateAfter(actions)}>{children}</AppStateProvider>;
  };
}
