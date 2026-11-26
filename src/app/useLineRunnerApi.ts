/**
 * The line runner the app lends to windows with a GUI (decision 6): running
 * command lines and learning how it went. The command line owns the context a
 * line needs, so it registers its runner here after each render; until it
 * does, running a line is refused. The same shape as src/app/usePostActionsApi.
 */

import { useCallback, useEffect, useRef } from 'react';

import { runLines } from '../commands/runLines';
import type { CommandContext } from '../commands/types';
import { t } from '../i18n/translate';
import type { LineOutcome, LineRunner } from '../views/LineRunnerContext';

/** What running a line answers before the command line has registered. */
function notReady(): LineOutcome {
  return { ok: false, message: t('app.command_line_not_ready') };
}

/** The runner to provide, and how the command line registers its own. */
export function useLineRunnerApi(): {
  readonly runner: LineRunner;
  readonly register: (runner: LineRunner) => void;
} {
  const runnerRef = useRef<LineRunner | null>(null);
  const register = useCallback((next: LineRunner) => {
    runnerRef.current = next;
  }, []);
  const runner = useCallback<LineRunner>(
    async (lines) => await (runnerRef.current?.(lines) ?? Promise.resolve(notReady())),
    [],
  );
  return { runner, register };
}

/** Register a runner of lines over {@link context} with {@link register}, after every render. */
export function useRegisterLineRunner(
  context: CommandContext,
  register: (runner: LineRunner) => void,
): void {
  useEffect(() => {
    register(async (lines) => await runLines(lines, context));
  });
}
