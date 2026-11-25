/**
 * The body the `/react` and `/unreact` definitions share (decision 6): the
 * post resolves the way the other post commands resolve theirs, the emoji is
 * the single word left over, and the instance's capabilities (decision 5)
 * gate the send — `emojiReactions` always, `customEmojiReactions` on top for
 * a `:shortcode:`. A shortcode travels to the endpoint without its colons,
 * as Pleroma expects; a Unicode emoji travels exactly as typed. The status
 * the instance answers replaces the post in every scrollback, and the window
 * prints the emoji, the verb and the label of the line that showed the post.
 * An instance that answers 404 or 501 to the send has the capability wrong:
 * its cached profile is dropped, so the next load detects it afresh.
 */

import { OK, fail } from './outcome';
import { printedLabel } from './statusLabel';
import { type StatusTarget, resolveStatusTarget } from './targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from './types';
import { react, unreact } from '../api/endpoints/reactions';
import { type ApiError, describeApiError } from '../api/errors';
import type { Status } from '../api/schemas/status';
import { type Capabilities, type FeatureFlag, hasFeature } from '../capabilities/capabilities';
import { forgetProfile } from '../capabilities/profileCache';
import { type Result, err, ok } from '../lib/result';
import { capabilitiesFor } from '../state/selectors';

/** Which of the two commands is running: attach the emoji, or detach it. */
export type ReactionKind = 'react' | 'unreact';

/** A `:shortcode:` reaction: a word that opens and closes on one colon. */
const SHORTCODE = /^:[A-Za-z0-9_]+:$/u;

/** One word of the command line: as typed, and as it leaves for the server. */
type Emoji = {
  readonly typed: string;
  readonly send: string;
  readonly custom: boolean;
};

/** One settled reaction: the post, the emoji, and which way it goes. */
type Reaction = {
  readonly target: StatusTarget;
  readonly emoji: Emoji;
  readonly kind: ReactionKind;
};

/**
 * The leftover argument text as the one reaction emoji: a `:shortcode:`
 * travels without its colons, anything else exactly as typed. An empty or
 * multi-word argument names no single emoji and is refused.
 */
function parseEmoji(rest: string, kind: ReactionKind): Result<Emoji, string> {
  const word = rest.trim();
  if (word === '' || /\s/u.test(word)) {
    return err(`Usage: /${kind} [label] <emoji>`);
  }
  const custom = SHORTCODE.test(word);
  return ok({ typed: word, send: custom ? word.slice(1, -1) : word, custom });
}

/** The capability flags {@link emoji} needs on the instance being reacted to. */
function requiredFlags(emoji: Emoji): readonly FeatureFlag[] {
  return emoji.custom ? ['emojiReactions', 'customEmojiReactions'] : ['emojiReactions'];
}

/**
 * Why {@link emoji} cannot be sent to {@link capabilities}: the refusal
 * naming the first capability that is missing, or null when all of them are
 * met. Capabilities that were never read refuse as though the plain
 * `emojiReactions` flag were absent — no reaction endpoint is trusted there.
 */
function refusal(capabilities: Capabilities | null, emoji: Emoji): string | null {
  if (capabilities === null) {
    return 'Instance lacks emojiReactions';
  }
  const missing = requiredFlags(emoji).find((flag) => !hasFeature(capabilities, flag));
  return missing === undefined ? null : `Instance lacks ${missing}`;
}

/** Whether {@link error} says the instance has no such endpoint: 404 or 501 (decision 5). */
function isUnsupported(error: ApiError): boolean {
  return error.kind === 'http' && (error.status === 404 || error.status === 501);
}

/** Attach or detach {@link reaction}'s emoji on its post. */
async function sendReaction(reaction: Reaction): Promise<Result<Status, ApiError>> {
  const { session } = reaction.target;
  const { id } = reaction.target.status;
  return reaction.kind === 'react'
    ? await react(session, id, reaction.emoji.send)
    : await unreact(session, id, reaction.emoji.send);
}

/**
 * Send {@link reaction}, share the status the instance answered with every
 * scrollback, and print the emoji, the verb and the label of the line.
 */
async function apply(reaction: Reaction, context: CommandContext): Promise<CommandOutcome> {
  const answered = await sendReaction(reaction);
  if (!answered.ok) {
    if (isUnsupported(answered.error)) {
      forgetProfile(context.stores.profiles, reaction.target.session.origin);
    }
    return fail(describeApiError(answered.error));
  }
  context.dispatch({ type: 'statusUpdated', status: answered.value });
  const verb = reaction.kind === 'react' ? 'reacted' : 'unreacted';
  const label = `[${printedLabel(context, reaction.target.status)}]`;
  context.print(`${reaction.emoji.typed} ${verb} to ${label}`);
  return OK;
}

/**
 * Run one emoji reaction command over {@link args}: resolve the post, parse
 * the emoji left over, refuse it when the instance cannot serve it, and send
 * it; on success every scrollback shows the answered status.
 */
async function runReaction(
  args: string,
  context: CommandContext,
  kind: ReactionKind,
): Promise<CommandOutcome> {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return fail(target.error);
  }
  const emoji = parseEmoji(target.value.rest, kind);
  if (!emoji.ok) {
    return fail(emoji.error);
  }
  const problem = refusal(capabilitiesFor(context.state, target.value.accountKey), emoji.value);
  if (problem !== null) {
    return fail(problem);
  }
  return await apply({ target: target.value, emoji: emoji.value, kind }, context);
}

/** {@link runReaction} for {@link kind}, in the shape a definition's run wants. */
export function reactionRun(kind: ReactionKind): CommandDefinition['run'] {
  return async (args, context) => await runReaction(args, context, kind);
}
