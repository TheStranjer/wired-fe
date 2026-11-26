/**
 * The shared refusal wordings (AGENTS.md "Layout": src/lib is pure helpers):
 * the one sentence every path says when it needs a signed-in account and
 * nobody is, so a command, a hotkey echo, a post and an upload all turn the
 * reader down with the same words.
 */

/** What refusing for want of an account says. */
export const NOT_LOGGED_IN_MESSAGE = 'Not logged in. Type /connect';

/** What refusing a post in a window that takes no posts (media, feed editor) says. */
export const NO_POST_MESSAGE = "You can't post in this window";
