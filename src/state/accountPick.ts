/**
 * The account picker's state (WFE-282): which question the modal box asks, or
 * null while none is open. A union on `purpose` so a later flow (picking the
 * account to post a draft as) adds a member; every switch on it must stay
 * exhaustive. Not persisted and not synced: a picker never outlives its page.
 */

/** The question the picker asks. */
export type AccountPick = {
  /** Choose the account plain text posts as by default, for the window's feed or everywhere. */
  readonly purpose: 'default';
  /** The window whose posting account is being chosen. */
  readonly windowId: string;
};

/** The actions that open and close the picker. */
export type AccountPickAction =
  | { readonly type: 'openAccountPick'; readonly pick: AccountPick }
  | { readonly type: 'closeAccountPick' };

/** The part of the app state the picker owns. */
export type AccountPickSlice = { readonly accountPick: AccountPick | null };

/** {@link state} after {@link action}; the same state when closing a picker that is not open. */
export function accountPickReducer<S extends AccountPickSlice>(
  state: S,
  action: AccountPickAction,
): S {
  switch (action.type) {
    case 'openAccountPick':
      return { ...state, accountPick: action.pick };
    case 'closeAccountPick':
      return state.accountPick === null ? state : { ...state, accountPick: null };
  }
}

/** {@link state} without an open picker once nobody is left to pick from. */
export function withoutLonelyPick<
  S extends AccountPickSlice & { readonly accounts: readonly unknown[] },
>(state: S): S {
  return state.accounts.length === 0 && state.accountPick !== null
    ? { ...state, accountPick: null }
    : state;
}
