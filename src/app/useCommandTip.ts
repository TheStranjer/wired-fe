/**
 * The tooltip of a title-bar button (WFE-312): its action, the command it
 * runs and the keys that run the same command, built from the available
 * registry and the effective keymap (the defaults under the reader's rebinds),
 * so rebinding a key changes the tooltip.
 */
import { useCallback, useMemo } from 'react';

import { useAvailableRegistry } from './useAvailableRegistry';
import { commandTip } from '../commands/commandDetail';
import { buildKeymap } from '../keys/keymap';
import { useAppState } from '../state/StateContext';

/** A function that words the tooltip of the button doing {@link action} by running `command`. */
export function useCommandTip(): (action: string, command: string) => string {
  const registry = useAvailableRegistry();
  const { settings } = useAppState();
  const keymap = useMemo(
    () => buildKeymap(registry, settings.keyOverrides),
    [registry, settings.keyOverrides],
  );
  return useCallback(
    (action, command) => commandTip(action, command, { registry, keymap }),
    [registry, keymap],
  );
}
