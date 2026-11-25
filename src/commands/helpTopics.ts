/**
 * The topics `/help <topic>` prints (decision 6): a name, one paragraph that
 * says how the thing works with the default keys, and the names of the
 * commands it covers. `/help` itself prints the paragraph and then each
 * covered command's summary from the registry, so a command is never
 * described twice. helpTopics.test.ts fails when a covered command, or any
 * `/word` the paragraph mentions, is not in the registry.
 */

/** One help topic: what `/help <name>` prints. */
export type HelpTopic = {
  /** The word after `/help`, lowercase. */
  readonly name: string;
  /** One paragraph, printed as one line. */
  readonly text: string;
  /** Names (not aliases) of the commands the topic covers, in the order they are listed. */
  readonly commands: readonly string[];
};

/** The topic of panes, floats, desktops and placement (decisions 12, 13 and 18). */
const LAYOUT: HelpTopic = {
  name: 'layout',
  text: [
    'A desktop is a tiling of panes plus floating windows; each pane shows one window,',
    'and a window can be shown in several panes or none.',
    'Split with /vsplit (Ctrl+B %, w v) or /split (Ctrl+B ", w s);',
    'move focus with /focus (Ctrl+B and an arrow, w h/j/k/l);',
    'close a pane with /unsplit (Ctrl+B x, w c) or keep just one with /only (Ctrl+B z, w o).',
    'Tear a pane off with /float (Ctrl+B f, w f) and put it back with /dock (Ctrl+B d, w d);',
    'drag its title bar, or Shift-drag it onto a pane to dock it there.',
    'Dividers drag, and take the arrow keys when focused; /resize and /equalize (w =) set shares.',
    'Desktops: /desktop (Alt+1..9, Alt+[ and Alt+], Ctrl+B c/n/p); /mvd moves a pane to another.',
    '/pop (p, or double-click a post) floats its thread; /people (Shift+p) toggles the people list.',
    '/compose (Ctrl+E, c) opens a composer window, floating by default;',
    '/reply with no text opens one bound to the post (Shift+r, or the reply button), r only fills the line.',
    'Commands that open windows take --in here|vsplit|split|float|hidden;',
    'on a click, Ctrl+click floats, Shift+click splits and middle-click opens it hidden.',
    'On a phone one pane shows at a time, with a pane switcher in its title bar.',
  ].join(' '),
  commands: [
    'vsplit',
    'split',
    'focus',
    'unsplit',
    'only',
    'float',
    'dock',
    'raise',
    'resize',
    'equalize',
    'swap',
    'desktop',
    'mvd',
    'win',
    'pop',
    'people',
    'compose',
    'reply',
  ],
};

/** The topic of feeds and how posts are drawn (decisions 14 and 15). */
const FEEDS: HelpTopic = {
  name: 'feeds',
  text: [
    'A feed merges sources from any signed-in accounts into one stream, newest first;',
    'a post several accounts see shows once.',
    'A source is <who>:<kind>: who is * (every account) or @handle,',
    'kind is home, mentions, dms, notifications, local, federated or tag:<name>.',
    'The first run makes a feed named stream (*:home, *:mentions, *:dms, *:notifications)',
    'that takes in accounts you sign in later, until you change it with /feed.',
    '/feed lists feeds, /feed <name> opens one, new, add, rm, rename and delete change them,',
    'and /feed edit <name> (or the ✎ button in its pane) opens the feed editor.',
    'Posts draw as cards or as IRC lines: /set density cards|lines for every window,',
    '/display for this one (density, avatars, images, or reset).',
    'A command on a post acts as the account that fetched it.',
  ].join(' '),
  commands: ['feed', 'display', 'set', 'home', 'notifications', 'local', 'federated', 'tag', 'as'],
};

/** The topic of the synced desk (decision 17). */
const SYNC: HelpTopic = {
  name: 'sync',
  text: [
    'Your desk (windows, desktops, floats, feeds, settings) is saved in this browser',
    'per device class, desktop or mobile, and synced through the settings store of a primary account.',
    'The newer copy wins; a change is pushed 3 seconds after the last one.',
    '/sync shows the account in use, /sync primary <handle> chooses it,',
    '/sync fallback add|rm|up <handle> orders the others (the first signed-in account whose server',
    'has a settings store is used), /sync now pulls then pushes, /sync off and /sync on switch it.',
    'The server caps the whole store at 1 MiB, so the synced copy is kept under 384 KiB per device class:',
    'hidden windows, empty desktops and key overrides past 200 are left out, with a warning;',
    'this device keeps everything.',
    'Wired, Pleroma and Akkoma servers have the store; Mastodon does not,',
    'so an account there keeps its desk on this device only.',
    '⇅ in the status line means a push is waiting, ⇅! that the last one failed.',
  ].join(' '),
  commands: ['sync'],
};

/** Every topic, in the order `/help` lists them. */
export const HELP_TOPICS: readonly HelpTopic[] = [LAYOUT, FEEDS, SYNC];

/** The topic called {@link name} (lowercase), or undefined. */
export function findTopic(name: string): HelpTopic | undefined {
  return HELP_TOPICS.find((topic) => topic.name === name);
}
