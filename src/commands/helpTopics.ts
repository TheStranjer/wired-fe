/**
 * The `/help <topic>` pages (decision 6): a topic is a name, one paragraph of
 * text and the names of the commands it covers. `/help` prints the paragraph
 * and then one line per covered command, read from the registry, so a
 * command's summary is never written twice. A test fails when a topic lists a
 * command the registry does not have. The paragraphs are catalog messages
 * (decision 19) read by a getter, so they follow the language in use; the
 * topic names stay English, since they are typed.
 */

import { t } from '../i18n/translate';

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
  get text(): string {
    return t('commands.help_topics.layout');
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
  get text(): string {
    return t('commands.help_topics.feeds', { name: '<name>' });
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
  get text(): string {
    return t('commands.help_topics.sync', { handle: '<handle>' });
  },
  commands: ['sync'],
};

/** Every topic, in the order /help lists them. */
export const HELP_TOPICS: readonly HelpTopic[] = [LAYOUT, FEEDS, SYNC];

/** The topic called {@link name} (lowercase), or undefined. */
export function lookupTopic(name: string): HelpTopic | undefined {
  return HELP_TOPICS.find((topic) => topic.name === name);
}
