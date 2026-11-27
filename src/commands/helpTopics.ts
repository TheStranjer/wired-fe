/**
 * The `/help <topic>` pages (decision 6): a topic is a name, a few lines of
 * text and the names of the commands it covers. `/help` prints the lines and
 * then one line per covered command, read from the registry, so a command's
 * summary is never written twice. A test fails when a topic lists a command
 * the registry does not have. Each line is its own catalog message (decision
 * 19), short enough to translate in one request, read by a getter so it
 * follows the language in use; the topic names stay English, since they are
 * typed.
 */

import { literals } from '../i18n/messages';
import { t } from '../i18n/translate';
import { PLAIN_SOURCES } from '../state/feeds';
import { PLACEMENTS } from '../state/placement';

/** One help topic. */
export type HelpTopic = {
  /** The word after `/help`; lowercase. A topic wins over a command of the same name unless the command is typed with its slash. */
  readonly name: string;
  /** The explanation, one printed line per entry, in order. */
  readonly lines: readonly string[];
  /** Canonical command names (no slash, no aliases) the topic covers, in the order they print. */
  readonly commands: readonly string[];
};

/** The desktop, its panes and floats, and how to move around them. */
const LAYOUT: HelpTopic = {
  name: 'layout',
  get lines(): readonly string[] {
    return [
      t('commands.help_topics.layout.panes'),
      t('commands.help_topics.layout.prefix_keys'),
      t('commands.help_topics.layout.navigation_keys'),
      t('commands.help_topics.layout.start_menu'),
      t('commands.help_topics.layout.desktop_keys'),
      t('commands.help_topics.layout.desktop_close', literals('prune')),
      t('commands.help_topics.layout.buttons'),
      t('commands.help_topics.layout.placement', { placements: PLACEMENTS.join('|') }),
      t('commands.help_topics.layout.phone'),
      t('commands.help_topics.layout.close'),
    ];
  },
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
  get lines(): readonly string[] {
    return [
      t('commands.help_topics.feeds.merge'),
      t('commands.help_topics.feeds.editor', { ...literals('edit', 'new'), name: '<name>' }),
      t('commands.help_topics.feeds.sources', {
        sources: PLAIN_SOURCES.join(', '),
        tag: 'tag:<name>',
      }),
      t(
        'commands.help_topics.feeds.display',
        literals('density', 'lines', 'avatars', 'images', 'off', 'reset'),
      ),
      t('commands.help_topics.feeds.labels'),
    ];
  },
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
  get lines(): readonly string[] {
    return [
      t('commands.help_topics.sync.saved'),
      t('commands.help_topics.sync.accounts', {
        ...literals('primary', 'fallback'),
        change: 'add|rm|up',
        handle: '<handle>',
      }),
      t('commands.help_topics.sync.devices'),
      t('commands.help_topics.sync.push', literals('now', 'off', 'on')),
      t('commands.help_topics.sync.budget'),
      t('commands.help_topics.sync.mastodon'),
    ];
  },
  commands: ['sync'],
};

/** Every topic, in the order /help lists them. */
export const HELP_TOPICS: readonly HelpTopic[] = [LAYOUT, FEEDS, SYNC];

/** The topic called {@link name} (lowercase), or undefined. */
export function lookupTopic(name: string): HelpTopic | undefined {
  return HELP_TOPICS.find((topic) => topic.name === name);
}
