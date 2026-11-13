/**
 * Type-level test for the command context (decision 6): the object literal in
 * the test only compiles while CommandContext is print with an optional level,
 * the command registry, the window list, the window dispatcher and the clear
 * callback, so widening or renaming a field has to change this test too.
 */
import { describe, expect, it } from 'vitest';

import type { CommandContext, PrintLevel, Registry } from './types';
import { initialWindowsState } from '../windows/model';

/** A registry with no commands in it, as a build with no definition files has. */
const EMPTY_REGISTRY: Registry = { commands: [], byName: new Map() };

/** A print that ignores its arguments; the annotation pins the optional level. */
const PRINT: (text: string, level?: PrintLevel) => void = () => undefined;

/** A window dispatcher and a clear that change nothing. */
const DISPATCH_WINDOWS: CommandContext['dispatchWindows'] = () => undefined;
const CLEAR_ACTIVE_WINDOW = (): undefined => undefined;

describe('CommandContext', () => {
  it('is print, the registry and the windows, which start at the status window', () => {
    const context: CommandContext = {
      print: PRINT,
      registry: EMPTY_REGISTRY,
      windows: initialWindowsState(),
      dispatchWindows: DISPATCH_WINDOWS,
      clearActiveWindow: CLEAR_ACTIVE_WINDOW,
    };

    expect(context.registry.commands).toStrictEqual([]);
    expect(context.windows.activeId).toBe('status');
  });
});
