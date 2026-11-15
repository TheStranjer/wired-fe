/**
 * `/about` (decision 6): what the active account's instance is and what it
 * can do, read from the {@link InstanceProfile} detection built on connect
 * (decision 5) — title and origin, backend family, post and poll limits, and
 * the feature flags it advertised. Arguments are ignored: the active
 * account's origin is the only subject. Without an account, or without its
 * instance having been detected, there is nothing to report.
 */

import type { Capabilities } from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { activeAccount } from '../../state/selectors';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The report was printed; there is nothing else to say. */
const OK: CommandOutcome = { ok: true };

/** Shown when the command has no connected instance to describe. */
const NOT_CONNECTED: CommandOutcome = {
  ok: false,
  message: 'Not connected. Type /connect',
};

/** The duration units from largest to smallest: seconds per unit, and suffix. */
const DURATION_UNITS: readonly (readonly [number, string])[] = [
  [86_400, 'd'],
  [3_600, 'h'],
  [60, 'm'],
];

/**
 * Format {@link seconds} as a whole number of the largest unit it reaches:
 * `5m`, `1h`, `30d`. Anything shorter than a minute counts in seconds.
 */
function formatDuration(seconds: number): string {
  const unit = DURATION_UNITS.find(([size]) => seconds >= size);
  if (unit === undefined) {
    return `${String(seconds)}s`;
  }
  const [size, suffix] = unit;
  return `${String(Math.floor(seconds / size))}${suffix}`;
}

/** The `features:` line: the advertised flags in order, or none at all. */
function featuresLine(capabilities: Capabilities): string {
  const names = [...capabilities.features];
  return `  features: ${names.length === 0 ? 'none' : names.join(', ')}`;
}

/** The five report lines of {@link profile}, as the scrollback shows them. */
function reportLines(profile: InstanceProfile): readonly string[] {
  const { backend, maxCharacters, maxMediaAttachments, pollLimits } = profile.capabilities;
  const span = `${formatDuration(pollLimits.minExpiration)}–${formatDuration(pollLimits.maxExpiration)}`;
  return [
    `${profile.title} at ${profile.origin}`,
    `  backend: ${backend}`,
    `  posts: up to ${String(maxCharacters)} characters, ${String(maxMediaAttachments)} attachments`,
    `  polls: ${String(pollLimits.maxOptions)} options of ${String(pollLimits.maxCharactersPerOption)} characters, ${span}`,
    featuresLine(profile.capabilities),
  ];
}

/** Print the active account's instance report, or why there is none. */
function handle(context: CommandContext): CommandOutcome {
  const account = activeAccount(context.state);
  const profile = account === null ? undefined : context.state.profiles.get(account.origin);
  if (profile === undefined) {
    return NOT_CONNECTED;
  }
  for (const line of reportLines(profile)) {
    context.print(line);
  }
  return OK;
}

/** The `/about` (alias `/info`) definition. */
export const command: CommandDefinition = {
  name: 'about',
  aliases: ['info'],
  usage: '/about',
  summary: 'Show what this instance is and can do',
  run: async (_args, context) => await Promise.resolve(handle(context)),
};
