/**
 * The actor of a notification as a click target, shared by the IRC line and the
 * card (decision 15; WFE-106): the `@handle` that leads a sentence, the sentence
 * with that handle taken off, and the move that opens the actor's profile window
 * from the window the notification is shown in. Pure: state in, plain values out.
 */
import type { Account } from '../api/schemas/account';
import type { AppState } from '../state/appState';
import { profileWindowOpen } from '../state/profileWindow';
import { windowAccountKey } from '../state/selectors';
import type { Dispatch } from '../state/StateContext';

/** One sentence with its leading actor {@link handle} taken off; null if it has none. */
export function withoutActor(sentence: string, handle: string): string | null {
  return sentence.startsWith(`${handle} `) ? sentence.slice(handle.length + 1) : null;
}

/** A handler asking for {@link account}'s profile window, owned by the window's account. */
export function openActor(
  app: { readonly state: AppState; readonly go: Dispatch },
  windowId: string,
  account: Account,
): () => void {
  return () => {
    app.go({
      type: 'windows',
      action: profileWindowOpen(account, windowAccountKey(app.state, windowId)),
    });
  };
}
