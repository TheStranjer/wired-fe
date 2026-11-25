/**
 * The `/help <topic>` pages (decision 6): a topic is a name, one paragraph of
 * text and the names of the commands it covers. `/help` prints the paragraph
 * and then one line per covered command, read from the registry, so a
 * command's summary is never written twice. A test fails when a topic lists a
 * command the registry does not have.
 */

/** One help topic. */
export type HelpTopic = {
  /** The word after `/help`; lowercase. A topic wins over a command of the same name unless the command is typed with its slash. */
  readonly name: string;
  /** One paragraph, printed as one line. */
  readonly text: string;
  /** Canonical command names (no slash, no aliases) the topic covers, in the order they print. */
  readonly commands: readonly string[];
};

/** The desktop, its panes and floats, and how to move around them. */
const LAYOUT: HelpTopic = {
  name: 'layout',
  text:
    'The screen is a desktop of panes split side by side (row) or stacked (column); any pane can be torn off into a float, a window you drag around inside the viewport. ' +
    'Keys: Ctrl+B % / " split, Ctrl+B arrows focus, Ctrl+B x closes the pane, Ctrl+B z keeps only this one, Ctrl+B f / d float and dock; in navigation mode (Esc) w v / w s split, w h j k l focus, w c closes the pane, w o keeps only this one, w = equalizes, w f / w d float and dock. ' +
    'Alt+1..9 jump to a desktop, Alt+[ and Alt+] step to the previous and next one. ' +
    'Ctrl+B & (or the × after the active desktop in the status line, or a middle-click on any desktop) closes a desktop and keeps its windows open (/win); /desktop prune closes every empty one. ' +
    'Buttons: ┃▾ and ━▾ split with a view, ⧉▾ pops a pane or a view out, ⊞ docks a float, ✕ closes. Shift-drag a float over a pane to dock it against that edge. ' +
    'Ctrl+click opens in a float, Shift+click in a side-by-side split, middle-click hidden; --in here|vsplit|split|float|hidden places any opened window. ' +
    'On a phone one pane shows at a time, with a ‹ 2/4 › switcher in its title bar. Closing a pane keeps its window; /close ends the window.',
  commands: [
    'vsplit',
    'split',
    'unsplit',
    'only',
    'focus',
    'swap',
    'resize',
    'equalize',
    'float',
    'dock',
    'raise',
    'pop',
    'desktop',
    'mvd',
    'win',
    'close',
    'people',
  ],
};

/** Feeds, cards and lines. */
const FEEDS: HelpTopic = {
  name: 'feeds',
  text:
    'A feed merges any sources from any signed-in accounts into one stream, newest first, with a post several accounts see shown once. ' +
    'Your first run makes one called stream (home, mentions, DMs and notifications of every account); /feed edit <name>, /feed new or the ✎ button in a feed pane opens the editor. ' +
    'Sources are home, mentions, dms, notifications, local, federated and tag:<name>. ' +
    'Posts show as cards by default; /display density lines switches this window to IRC lines, /display avatars off and /display images off hide those, /display reset clears the overrides, and /set density, /set avatars and /set images change the default for every window. ' +
    'Every post has a short label like [a3]: /fav a3, /reply a3, /pop a3 act on it, as the account that fetched it.',
  commands: [
    'feed',
    'display',
    'home',
    'local',
    'federated',
    'notifications',
    'tag',
    'set',
    'reply',
    'compose',
  ],
};

/** Desk sync. */
const SYNC: HelpTopic = {
  name: 'sync',
  text:
    'Your desktops, floats, open windows, feeds and settings are saved in this browser and synced through your server, so the desk follows you. ' +
    'A primary account holds the synced copy; ordered fallbacks take over when it has no settings store or its token fails (/sync primary <handle>, /sync fallback add|rm|up <handle>). ' +
    'Desktop browsers (Windows, macOS, Linux, ChromeOS) and mobile ones (Android, iOS, iPadOS) each keep their own layout, and the newer copy wins. ' +
    'A push follows the last change by 3 seconds; /sync now pulls and pushes at once, /sync off and /sync on switch it. ' +
    'The server caps the whole store at 1 MiB, so a desk too big for the 384 KiB budget leaves out hidden windows, empty desktops and extra key overrides from the synced copy only, and says so. ' +
    'Mastodon has no settings store: an account there keeps its desk in this browser alone.',
  commands: ['sync'],
};

/** Every topic, in the order /help lists them. */
export const HELP_TOPICS: readonly HelpTopic[] = [LAYOUT, FEEDS, SYNC];

/** The topic called {@link name} (lowercase), or undefined. */
export function lookupTopic(name: string): HelpTopic | undefined {
  return HELP_TOPICS.find((topic) => topic.name === name);
}
