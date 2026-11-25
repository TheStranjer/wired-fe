/**
 * The actor of a notification as a click target, shared by the IRC line and the
 * card (decision 15; WFE-106): the `@handle` that leads a sentence, the sentence
 * with that handle taken off, and the move that opens the actor's profile window
 * from the window the notification is shown in. Pure: state in, plain values out.
 */
import type { Account } from '../api/schemas/account';
import type { ClickModifiers } from '../lib/clickModifiers';
import type { AppState } from '../state/appState';
import { clickOpen } from '../state/placementFromClick';
import { profileWindowOpen } from '../state/profileWindow';
import { windowAccountKey } from '../state/selectors';
import type { Dispatch } from '../state/StateContext';

/** One sentence with its leading actor {@link handle} taken off; null if it has none. */
export function withoutActor(sentence: string, handle: string): string | null {
  return sentence.startsWith(`${handle} `) ? sentence.slice(handle.length + 1) : null;
}

/**
 * A handler asking for {@link account}'s profile window, owned by the window's
 * account and placed as the click says (WFE-238).
 */
export function openActor(
  app: { readonly state: AppState; readonly go: Dispatch },
  windowId: string,
  account: Account,
): (click: ClickModifiers) => void {
  return (click) => {
    const open = profileWindowOpen(account, windowAccountKey(app.state, windowId));
    app.go(clickOpen(app.state.settings, open, click));
  };
}
