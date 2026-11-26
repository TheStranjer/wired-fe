/**
 * The words Tab may complete to (decision 6, WFE-124): commands from the
 * registry narrowed to what the active account's backend can do (WFE-172)
 * first, then what the buffers have seen and what the account's instance
 * serves. Custom emoji are not offered on a `/react` line unless the instance
 * has `customEmojiReactions`. Without a loadable registry there are no
 * commands to offer, and the rest stands on its own. `/display` arguments
 * (its keys and their values), `/desktop` and `/mvd` arguments, `/focus` and
 * `/swap` directions, and the view names after `/vsplit` and `/split` are
 * offered ahead of everything else, as are the subcommands, feed names and
 * sources after `/feed`; the listed instances after `/connect` (WFE-307). The post labels of the active window (WFE-301) come
 * before all of them, so the argument of a command that takes a post prefers
 * a label, and a `[` word completes to one anywhere on the line. The languages
 * after `/lang` complete too (WFE-310). The rows are described when they are
 * shown and the hook follows the language, so a switch redraws them in it.
 */

import { appRegistry } from './registry';
import { useAvailableRegistry } from './useAvailableRegistry';
import { hasFeature } from '../capabilities/capabilities';
import { commandProvider } from '../commands/commandProvider';
import type { Provider } from '../commands/complete';
import { connectProvider } from '../commands/connectWords';
import { desktopProvider } from '../commands/desktopWords';
import { directionProvider } from '../commands/directionWords';
import { displayProvider } from '../commands/displayWords';
import { feedProvider } from '../commands/feedWords';
import { languageProvider } from '../commands/languageWords';
import { postTargetWords } from '../commands/postTargets';
import { viewProvider } from '../commands/viewProvider';
import { buildConfig } from '../config/config';
import { useLocale } from '../i18n/I18nProvider';
import { capabilitiesFor } from '../state/selectors';
import { useAppState } from '../state/StateContext';
import {
  type HandleSearch,
  emojiProvider,
  handleProvider,
  tagProvider,
} from '../views/completionProviders';
import { labelProvider } from '../views/labelProvider';
import { withoutReactionWords } from '../views/reactionProviders';
import { useCustomEmojis } from '../views/useCustomEmojis';

/**
 * The providers for the active account, in the order they are asked; the
 * handle provider also offers what the instance's search found
 * ({@link searched}, ./useHandleSearch).
 */
export function useCompletionProviders(searched: HandleSearch): readonly Provider[] {
  useLocale();
  const state = useAppState();
  const registry = useAvailableRegistry();
  const emojis = useCustomEmojis(state.activeAccountKey);
  const capabilities = capabilitiesFor(state, state.activeAccountKey);
  const custom = capabilities !== null && hasFeature(capabilities, 'customEmojiReactions');
  const emoji = emojiProvider(emojis);
  const seen = [
    handleProvider(state, searched),
    tagProvider(state),
    custom ? emoji : withoutReactionWords(emoji),
  ];
  const labels = labelProvider(state, postTargetWords(registry));
  return appRegistry().ok
    ? [
        labels,
        displayProvider(),
        desktopProvider(),
        directionProvider(),
        languageProvider(),
        viewProvider(),
        connectProvider(buildConfig.instances),
        feedProvider(state),
        commandProvider(registry),
        ...seen,
      ]
    : [labels, ...seen];
}
