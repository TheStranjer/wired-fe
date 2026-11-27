/**
 * Literal command words stay out of translated text (decision 19, WFE-336):
 * the check that finds them in a message, the rule it enforces on the English
 * source, and the proof that a translation which words everything around the
 * arguments still shows `now`, `home`, `here` and the rest verbatim.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import { lookupTopic } from './helpTopics';
import english from '../i18n/locales/en.json';
import { type MessageKey, flatten } from '../i18n/messages';
import { SETTING_KEYS } from '../state/settingKeys';
import { bareLiterals } from '../test/commandLiterals';
import { installFakeLocale } from '../test/i18n';

/** The English push line of `/help sync`, as it read before the literals became arguments. */
const PUSH_EN =
  'A push follows the last change by 3 seconds; /sync now pulls and pushes at once, /sync off and /sync on switch it.';

/** The English sources line of `/help feeds`, as before. */
const SOURCES_EN =
  'Sources are home, mentions, dms, notifications, local, federated and tag:<name>.';

/** The English description of the `replyIn` setting, as before. */
const REPLY_IN_EN = 'Where a reply composer opens: here, vsplit, split, float or hidden';

/** The line `/help sync` prints about pushing. */
function pushLine(): string | undefined {
  return lookupTopic('sync')?.lines[3];
}

/** The line `/help feeds` prints about sources. */
function sourcesLine(): string | undefined {
  return lookupTopic('feeds')?.lines[2];
}

/** What `/set` prints beside `replyIn`. */
function replyInLine(): string | undefined {
  return SETTING_KEYS.find((setting) => setting.key === 'replyIn')?.description;
}

describe(bareLiterals, () => {
  it('names the literals that follow a command or a flag', () => {
    expect(bareLiterals('/sync now pulls and pushes at once')).toStrictEqual(['now']);
    expect(bareLiterals('/sync off and /sync on switch it')).toStrictEqual(['off', 'on']);
    expect(bareLiterals('Type /sync primary first')).toStrictEqual(['primary']);
    expect(bareLiterals('--in here|vsplit|split places it')).toStrictEqual([
      'here',
      'vsplit',
      'split',
    ]);
  });

  it('names every literal of a typed command line once', () => {
    expect(bareLiterals('/sync now pulls, /sync now again')).toStrictEqual(['now']);
    expect(bareLiterals('/display avatars off and /display images off hide those')).toStrictEqual([
      'avatars',
      'off',
      'images',
    ]);
  });

  it('names the words of a list of three or more', () => {
    expect(bareLiterals('Where it opens: here, vsplit, split, float or hidden')).toStrictEqual([
      'here',
      'vsplit',
      'split',
      'float',
      'hidden',
    ]);
    expect(
      bareLiterals('Sources are home, mentions, dms, notifications, local and tag:rust'),
    ).toStrictEqual(['home', 'mentions', 'dms', 'notifications', 'local', 'tag:rust']);
  });

  it('reads sources written with an account in front', () => {
    expect(bareLiterals('(try @me@host:home, *:mentions or @me@host:tag:rust)')).toStrictEqual([
      '@me@host:home',
      '*:mentions',
      '@me@host:tag:rust',
    ]);
  });

  it('passes literals that arrive as arguments, quoted text and nested arguments', () => {
    expect(bareLiterals('/sync {now} pulls, /sync {off} and /sync {on} switch it')).toStrictEqual(
      [],
    );
    expect(bareLiterals("Type /sync {primary} '<handle>' first")).toStrictEqual([]);
    expect(bareLiterals('/sync {mode, select, a {now} other {off}} first')).toStrictEqual([]);
    expect(
      bareLiterals('Where it opens: {here}, {vsplit}, {split}, {float} or {hidden}'),
    ).toStrictEqual([]);
  });

  it('passes prose that merely holds a literal word', () => {
    expect(bareLiterals('Password changed. You can log in with it now.')).toStrictEqual([]);
    expect(bareLiterals('Sync: off')).toStrictEqual([]);
    expect(bareLiterals('Closing a pane keeps its window; /close ends the window.')).toStrictEqual(
      [],
    );
    expect(bareLiterals('Show author avatars on posts')).toStrictEqual([]);
    expect(bareLiterals('…')).toStrictEqual([]);
  });

  it('does not let the end of a sentence carry a command over to the next', () => {
    expect(bareLiterals('Use /sync. off we go')).toStrictEqual([]);
  });

  it('does not count prose that runs up to a command', () => {
    expect(bareLiterals('Switch to IRC lines, /close ends it')).toStrictEqual([]);
  });
});

describe('the English source', () => {
  it('holds no command literal as plain text, outside the usage lines of pure command syntax', () => {
    const offenders = [...flatten(english)]
      .filter(([key]) => !key.endsWith('.usage'))
      .map(([key, message]) => [key, bareLiterals(message)] as const)
      .filter(([, found]) => found.length > 0);

    expect(offenders).toStrictEqual([]);
  });
});

describe('a translation that words everything around the arguments', () => {
  it.each([
    { locale: 'de', adverb: 'jetzt', sources: 'Quellen sind {sources} und {tag}.', or: 'oder' },
    { locale: 'ru', adverb: 'теперь', sources: 'Источники: {sources} и {tag}.', or: 'или' },
  ])('keeps now, the sources and the placements verbatim in $locale', (words) => {
    const { locale, adverb, sources, or } = words;
    installFakeLocale(
      {
        commands: {
          help_topics: {
            feeds: { sources },
            sync: { push: `${adverb}: /sync {now} holt, /sync {off} und /sync {on} schalten es.` },
          },
        },
        state: { setting_reply_in: `Wo: {here}, {vsplit}, {split}, {float} ${or} {hidden}` },
      },
      locale,
    );

    expect([pushLine()?.includes('/sync now '), pushLine()?.includes('/sync off ')]).toStrictEqual([
      true,
      true,
    ]);
    expect(pushLine()).toContain('/sync on ');
    expect(sourcesLine()).toContain('home, mentions, dms, notifications, local, federated');
    expect(sourcesLine()).toContain('tag:<name>');
    expect(replyInLine()).toContain(`here, vsplit, split, float ${or} hidden`);
  });

  it('falls back to English when its arguments are not the source’s', () => {
    installFakeLocale(
      {
        commands: { help_topics: { sync: { push: 'Ein Push: /sync jetzt holt alles.' } } },
        state: { setting_reply_in: 'Wo: hier, vsplit, split, float oder hidden' },
      },
      'de',
    );

    expect(pushLine()).toBe(PUSH_EN);
    expect(replyInLine()).toBe(REPLY_IN_EN);
  });
});

describe('the messages that carry literals', () => {
  it('read in English exactly as they did', () => {
    expect(pushLine()).toBe(PUSH_EN);
    expect(sourcesLine()).toBe(SOURCES_EN);
    expect(replyInLine()).toBe(REPLY_IN_EN);
  });

  it('are still typed keys, so an unknown key fails tsc', () => {
    expectTypeOf<'commands.help_topics.sync.push'>().toExtend<MessageKey>();
    expectTypeOf<'commands.help_topics.sync.nope'>().not.toExtend<MessageKey>();

    expect(flatten(english).has('commands.help_topics.sync.nope')).toBe(false);
  });
});
