/**
 * The command registry as the active account's backend sees it (decision 6,
 * WFE-172): the one full registry narrowed to the commands that backend can
 * do. Everything generated from the registry — /help, tab completion, the
 * keymap, /binds — reads this one, so none of them offers what the server
 * would refuse. It is worked out once per account switch or capability
 * change, not per keystroke.
 */

import { useMemo } from 'react';

import { appRegistry } from './registry';
import { availableCommands } from '../commands/available';
import type { Registry } from '../commands/types';
import { activeAccount, capabilitiesFor } from '../state/selectors';
import { useAppState } from '../state/StateContext';

/** The commands the registry holds when the definitions could not be loaded. */
const NO_COMMANDS: Registry = { commands: [], byName: new Map() };

/** The full registry; none at all when the definitions could not be loaded. */
function loadedRegistry(): Registry {
  const built = appRegistry();
  return built.ok ? built.value : NO_COMMANDS;
}

/** The commands available to the active account, recomputed when its capabilities change. */
export function useAvailableRegistry(): Registry {
  const state = useAppState();
  const signedIn = activeAccount(state) !== null;
  const capabilities = capabilitiesFor(state, state.activeAccountKey);
  return useMemo(
    () => availableCommands(loadedRegistry(), { signedIn, capabilities }),
    [signedIn, capabilities],
  );
}
