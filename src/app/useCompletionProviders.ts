/**
 * The words Tab may complete to (decision 6, WFE-124): commands from the
 * registry narrowed to what the active account's backend can do (WFE-172)
 * first, then what the buffers have seen and what the account's instance
 * serves. Custom emoji are not offered on a `/react` line unless the instance
 * has `customEmojiReactions`. Without a loadable registry there are no
 * commands to offer, and the rest stands on its own. `/display` arguments
 * (its keys and their values) are offered ahead of everything else.
 */

import { appRegistry } from './registry';
import { useAvailableRegistry } from './useAvailableRegistry';
import { hasFeature } from '../capabilities/capabilities';
import { type Provider, commandProvider } from '../commands/complete';
import { desktopProvider } from '../commands/desktopWords';
import { displayProvider } from '../commands/displayWords';
import { capabilitiesFor } from '../state/selectors';
import { useAppState } from '../state/StateContext';
import { emojiProvider, handleProvider, tagProvider } from '../views/completionProviders';
import { withoutReactionWords } from '../views/reactionProviders';
import { useCustomEmojis } from '../views/useCustomEmojis';

/** The providers for the active account, in the order they are asked. */
export function useCompletionProviders(): readonly Provider[] {
  const state = useAppState();
  const registry = useAvailableRegistry();
  const emojis = useCustomEmojis(state.activeAccountKey);
  const capabilities = capabilitiesFor(state, state.activeAccountKey);
  const custom = capabilities !== null && hasFeature(capabilities, 'customEmojiReactions');
  const emoji = emojiProvider(emojis);
  const seen = [
    handleProvider(state),
    tagProvider(state),
    custom ? emoji : withoutReactionWords(emoji),
  ];
  return appRegistry().ok
    ? [displayProvider(), desktopProvider(), commandProvider(registry), ...seen]
    : seen;
}
