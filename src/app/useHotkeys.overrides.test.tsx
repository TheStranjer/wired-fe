/**
 * Tests for the hotkeys following the reader's own bindings (WFE-130): a new
 * chord runs the line `/bind` gave it, a rebound chord runs the user's line
 * instead of the command's default, an unbound default leaves its key to the
 * keyboard, and the keymap is rebuilt as soon as the settings carry new
 * overrides — the exact move a `/bind` dispatch makes.
 */
import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import type { JSX, RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useHotkeys } from './useHotkeys';
import { buildRegistry } from '../commands/registry';
import type { CommandContext, CommandOutcome, Registry } from '../commands/types';
import type { KeyOverride } from '../lib/keyOverride';
import { type AppState, initialAppState } from '../state/appState';
import { DEFAULT_SETTINGS } from '../state/settings';
import { fakeCommandContext } from '../test/commandContext';

/** The one outcome the probe command reports. */
const OK: CommandOutcome = { ok: true };

/** Records every run of /probe. */
const PROBE_RUN = vi.fn(async (): Promise<CommandOutcome> => await Promise.resolve(OK));

/** The probe command, its only default binding navigation-mode `p` -> `/probe x`. */
const PROBE = {
  name: 'probe',
  aliases: [],
  usage: '/probe <word>',
  summary: 'Probe the hotkey path',
  run: PROBE_RUN,
  bindings: [{ mode: 'navigation', chord: 'p', args: 'x' }],
} as const;

/** The one-command registry; a build failure is a broken test. */
function registry(): Registry {
  const built = buildRegistry([PROBE]);
  if (!built.ok) {
    throw new Error(built.error);
  }
  return built.value;
}

/** The context of a navigation-mode session whose reader made {@link overrides}. */
function overrideContext(overrides: readonly KeyOverride[]): CommandContext {
  const state: AppState = {
    ...initialAppState({ ...DEFAULT_SETTINGS, keyOverrides: overrides }),
    mode: 'navigation',
  };
  return fakeCommandContext({ state, registry: registry() });
}

/** Props of the test component {@link Host}. */
type HostProps = {
  readonly context: CommandContext;
};

/** A component that mounts the hook under test over one plain input. */
function Host({ context }: HostProps): JSX.Element {
  const inputRef: RefObject<HTMLInputElement | null> = useRef<HTMLInputElement>(null);
  useHotkeys(inputRef, context);
  return <input aria-label="command line" ref={inputRef} />;
}

describe('the hotkeys and /bind', () => {
  it('runs the line a new binding gave its chord', () => {
    const context = overrideContext([{ mode: 'navigation', chord: 'q', line: '/probe y' }]);
    render(<Host context={context} />);

    const prevented = fireEvent.keyDown(window, { key: 'q' });

    expect(prevented).toBe(false);
    expect(PROBE_RUN).toHaveBeenCalledWith('y', context);
  });

  it('runs the rebound line instead of the command’s own default', () => {
    const context = overrideContext([{ mode: 'navigation', chord: 'p', line: '/probe z' }]);
    render(<Host context={context} />);

    fireEvent.keyDown(window, { key: 'p' });

    expect(PROBE_RUN).toHaveBeenCalledWith('z', context);
    expect(PROBE_RUN).not.toHaveBeenCalledWith('x', context);
  });

  it('leaves a default chord the reader unbound to the keyboard', () => {
    const context = overrideContext([{ mode: 'navigation', chord: 'p', line: null }]);
    render(<Host context={context} />);

    const notPrevented = fireEvent.keyDown(window, { key: 'p' });

    expect(notPrevented).toBe(true);
    expect(PROBE_RUN).not.toHaveBeenCalledWith('x', context);
  });

  it('rebuilds the keymap when the settings start carrying a new override', () => {
    const before = overrideContext([]);
    const view = render(<Host context={before} />);

    expect(fireEvent.keyDown(window, { key: 'q' })).toBe(true);

    const after = overrideContext([{ mode: 'navigation', chord: 'q', line: '/probe y' }]);
    view.rerender(<Host context={after} />);

    expect(fireEvent.keyDown(window, { key: 'q' })).toBe(false);
    expect(PROBE_RUN).toHaveBeenCalledWith('y', after);
  });
});
