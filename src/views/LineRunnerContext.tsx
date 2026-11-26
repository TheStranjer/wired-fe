/**
 * The seam between a window with a GUI and the command line (decision 6): the
 * composition root provides a way to run command lines and learn how it went,
 * so a window — the feed editor — does what its buttons mean by running the
 * same lines a typed command would, and the views never import the commands.
 * Without a provider nothing runs and every run is refused.
 */

import { createContext, use } from 'react';
import type { JSX, ReactNode } from 'react';

import { t } from '../i18n/translate';

/** How running lines went: success, or the message of the first refusal. */
export type LineOutcome = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** Something that runs command lines in order, stopping at the first refusal. */
export type LineRunner = (lines: readonly string[]) => Promise<LineOutcome>;

/** What a tree with no provider runs: nothing, and says so. */
const NO_RUNNER: LineRunner = async () =>
  await Promise.resolve({ ok: false, message: t('views.runner.unavailable') });

const LineRunnerContext = createContext<LineRunner>(NO_RUNNER);

/** Put {@link runner} in front of {@link children}. */
export function LineRunnerProvider(props: {
  readonly runner: LineRunner;
  readonly children: ReactNode;
}): JSX.Element {
  return <LineRunnerContext value={props.runner}>{props.children}</LineRunnerContext>;
}

/** The runner the app lends, or the one that refuses everything. */
export function useLineRunner(): LineRunner {
  return use(LineRunnerContext);
}
