/**
 * What `/reply` and `/quote` share (WFE-244, WFE-262): both create their status
 * as the target's account instead of through the active window, so both hand
 * the answer to that window only when it shows this account's stream, and both
 * open a bound composer, rather than post, when they were given no text.
 */

import type { CommandContext } from './types';
import type { Status } from '../api/schemas/status';
import { statusesAction } from '../state/pageActions';
import { type WindowKind, activeWindow } from '../windows/model';

/** The window kinds that show one account's conversation and take posts. */
const FEED_KINDS: ReadonlySet<WindowKind> = new Set<WindowKind>([
  'home',
  'local',
  'federated',
  'hashtag',
  'thread',
  'dm',
]);

/** Text that is only a `--in` flag, with or without its word: it asks for the composer, not a post. */
const FLAG_ONLY = /^--in(?:\s+\S+)?$/u;

/** Whether {@link text} asks for a composer: nothing, or only a `--in` flag. */
export function wantsComposer(text: string): boolean {
  return text === '' || FLAG_ONLY.test(text);
}

/** Hand {@link created} to the active window when it shows this account's stream. */
export function addToActiveWindow(context: CommandContext, created: Status): void {
  const win = activeWindow(context.state.windows);
  if (!FEED_KINDS.has(win.ref.kind)) {
    return;
  }
  context.dispatch(statusesAction(win.id, [created], 'newer'));
}
