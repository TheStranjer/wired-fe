/**
 * `/about` (decision 6): what the active account's instance is and what it
 * can do, read from the {@link InstanceProfile} detection built on connect
 * (decision 5) — title and origin, backend family, post and poll limits, and
 * the feature flags it advertised, and the device class (decision 17). Arguments are ignored: the active
 * account's origin is the only subject. Without an account, or without its
 * instance having been detected, there is nothing to report.
 */

import type { Capabilities } from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { t } from '../../i18n/translate';
import type { DeviceClass } from '../../lib/deviceClass';
import { formatDuration } from '../../lib/duration';
import { activeAccount } from '../../state/selectors';
import { OK, contextRun, fail } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The `features:` line: the advertised flags in order, or none at all. */
function featuresLine(capabilities: Capabilities): string {
  const names = [...capabilities.features];
  return t('commands.defs.about.features', { count: names.length, names: names.join(', ') });
}

/** The six report lines of {@link profile} on a {@link device}, as the scrollback shows them. */
function reportLines(profile: InstanceProfile, device: DeviceClass): readonly string[] {
  const { backend, maxCharacters, maxMediaAttachments, pollLimits } = profile.capabilities;
  const span = `${formatDuration(pollLimits.minExpiration)}–${formatDuration(pollLimits.maxExpiration)}`;
  return [
    t('commands.defs.about.title_at', { title: profile.title, origin: profile.origin }),
    `  ${t('commands.defs.about.backend', { backend })}`,
    `  ${t('commands.defs.about.posts', { characters: String(maxCharacters), attachments: maxMediaAttachments })}`,
    `  ${t('commands.defs.about.polls', {
      options: pollLimits.maxOptions,
      characters: String(pollLimits.maxCharactersPerOption),
      span,
    })}`,
    `  ${featuresLine(profile.capabilities)}`,
    `  ${t('commands.defs.about.device', { device })}`,
  ];
}

/** Print the active account's instance report, or why there is none. */
function handle(context: CommandContext): CommandOutcome {
  const account = activeAccount(context.state);
  const profile = account === null ? undefined : context.state.profiles.get(account.origin);
  if (profile === undefined) {
    return fail(t('commands.defs.about.not_connected'));
  }
  for (const line of reportLines(profile, context.deviceClass)) {
    context.print(line);
  }
  return OK;
}

/** The `/about` (alias `/info`) definition. */
export const command: CommandDefinition = {
  name: 'about',
  aliases: ['info'],
  usage: '/about',
  get summary(): string {
    return t('commands.defs.about.summary');
  },
  run: contextRun(handle),
};
