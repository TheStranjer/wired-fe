/**
 * Opening a hashtag's timeline window (AGENTS.md "Windows, like IRC buffers"):
 * the one transition the `/tag` command and every hashtag link in a post's body
 * ask for, built here in the pure state layer so commands and views share it
 * without importing each other (AGENTS.md "Layout"). Opening the same tag twice
 * finds the window that already shows it (src/windows/reducer).
 */

import type { OpenAction } from './placement';

/**
 * The window-list transition that opens the timeline of the hashtag {@link name}
 * (already lowercase, without its `#`), owned by the window-list state
 * {@link accountKey} names, titled `#<name>`.
 */
export function hashtagWindowOpen(name: string, accountKey: string): OpenAction {
  return {
    type: 'open',
    ref: { kind: 'hashtag', accountKey, target: name },
    title: `#${name}`,
  };
}
