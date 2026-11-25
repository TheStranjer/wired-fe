/**
 * The Unicode emoji the picker offers (WFE-265): an adapter from the
 * `emojibase-data` compact English list onto `{ emoji, name, group, keywords }`,
 * the nine groups the picker shows them under and the one search both the
 * Unicode and the custom emoji go through. Pure: unknown data in, plain data out.
 */
import { isRecord } from './guards';

/** The groups of the picker's Emoji section, in the order it shows them. */
type EmojiGroupKey =
  | 'smileys'
  | 'people'
  | 'animals'
  | 'food'
  | 'activities'
  | 'travel'
  | 'objects'
  | 'symbols'
  | 'flags';

/** One Unicode emoji: the character, its Unicode name, its group and its search words. */
export type UnicodeEmoji = {
  readonly emoji: string;
  readonly name: string;
  readonly group: EmojiGroupKey;
  readonly keywords: readonly string[];
};

/** One group of emoji under its heading. */
export type EmojiGroup = {
  readonly key: EmojiGroupKey;
  readonly title: string;
  readonly emojis: readonly UnicodeEmoji[];
};

/** Every group with its heading, in the picker's order. */
const GROUP_TITLES: readonly (readonly [EmojiGroupKey, string])[] = [
  ['smileys', 'smileys & emotion'],
  ['people', 'people & body'],
  ['animals', 'animals & nature'],
  ['food', 'food & drink'],
  ['activities', 'activities'],
  ['travel', 'travel & places'],
  ['objects', 'objects'],
  ['symbols', 'symbols'],
  ['flags', 'flags'],
];

/** The group of each emojibase group number; the skin-tone components (2) have none. */
const GROUP_BY_NUMBER: Readonly<Record<number, EmojiGroupKey>> = {
  0: 'smileys',
  1: 'people',
  3: 'animals',
  4: 'food',
  5: 'travel',
  6: 'activities',
  7: 'objects',
  8: 'symbols',
  9: 'flags',
};

/** Whether {@link value} is a string, for narrowing the tag list. */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** One entry of the data as an emoji, or null for one that is no emoji of a group. */
function adaptEntry(entry: unknown): UnicodeEmoji | null {
  if (!isRecord(entry)) {
    return null;
  }
  const { unicode, label, group, tags } = entry;
  const key = typeof group === 'number' ? GROUP_BY_NUMBER[group] : undefined;
  if (typeof unicode !== 'string' || typeof label !== 'string' || key === undefined) {
    return null;
  }
  return {
    emoji: unicode,
    name: label,
    group: key,
    keywords: Array.isArray(tags) ? tags.filter(isString) : [],
  };
}

/**
 * The emojibase compact list {@link raw} as emoji, skin-tone variants and
 * entries that belong to no group left out. Anything but a list adapts to none.
 */
export function adaptEmojis(raw: unknown): readonly UnicodeEmoji[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((entry: unknown) => {
    const emoji = adaptEntry(entry);
    return emoji === null ? [] : [emoji];
  });
}

/** {@link emojis} under their group headings, in the picker's order; empty groups are left out. */
export function groupEmojis(emojis: readonly UnicodeEmoji[]): readonly EmojiGroup[] {
  return GROUP_TITLES.map(([key, title]) => ({
    key,
    title,
    emojis: emojis.filter((emoji) => emoji.group === key),
  })).filter((group) => group.emojis.length > 0);
}

/** The words of a search: lower case, split on blanks and colons (`:blob:` finds `blob`). */
export function searchTerms(query: string): readonly string[] {
  return query
    .toLowerCase()
    .split(/[\s:]+/u)
    .filter((term) => term !== '');
}

/** Whether every one of {@link terms} is part of some word of {@link words}; no terms match all. */
export function matchesTerms(terms: readonly string[], words: readonly string[]): boolean {
  const haystack = words.join(' ').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/** The {@link emojis} whose character, name or keywords hold every word of {@link query}. */
export function filterEmojis(
  emojis: readonly UnicodeEmoji[],
  query: string,
): readonly UnicodeEmoji[] {
  const terms = searchTerms(query);
  return emojis.filter((emoji) =>
    matchesTerms(terms, [emoji.emoji, emoji.name, ...emoji.keywords]),
  );
}
