/**
 * Tab completion of the instance after `/connect` (WFE-307, decision 6): on a
 * `list` build the first argument completes to the configured instances, each
 * written as a host (`wired.example`), the form `normalizeTypedOrigin` accepts,
 * and the suggestion list shows them as rows to click. Builds with nothing to
 * choose from (every other mode, a list with no origins) offer nothing.
 */

import type { Provider } from './complete';
import { instanceChoices } from '../accounts/origin';
import type { InstancesConfig } from '../config/schema';
import { instanceWord } from '../lib/origin';
import { compareWords } from '../lib/words';

/** A line that is a connect command (or an alias of it) and its first, unfinished argument. */
const FIRST_ARGUMENT = /^\s*\/(?:connect|server|login)\s+\S*$/iu;

/** The provider for the instance after `/connect`: the listed hosts that start with the typed text. */
export function connectProvider(instances: InstancesConfig): Provider {
  const origins = instanceChoices(instances)?.origins ?? [];
  const byWord = new Map(origins.map((origin) => [instanceWord(origin), origin]));
  return {
    accepts: (_word, isFirstWord, line) => !isFirstWord && FIRST_ARGUMENT.test(line ?? ''),
    candidates: (word) => {
      const prefix = word.toLowerCase();
      return [...byWord]
        .filter(([host, origin]) => host.startsWith(prefix) || origin.startsWith(prefix))
        .map(([host]) => host)
        .toSorted(compareWords);
    },
    describe: (candidate) => ({
      word: candidate,
      label: candidate,
      description: byWord.get(candidate) ?? '',
    }),
    bare: true,
  };
}
