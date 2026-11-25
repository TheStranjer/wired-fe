/**
 * What the emoji picker (WFE-265) shows, as plain data: the post's own
 * reactions, the instance's custom emoji by category and the Unicode emoji by
 * group, each cut down by one search, as sections of cells. Every cell carries
 * the text `/react` takes and whether choosing it takes the reaction back. The
 * cells of all sections are numbered in one run so the keyboard walks them as
 * one grid. Pure: data and a query in, sections out.
 */
import { isHttps } from './emojify';
import { shortcodeOf } from './ReactionChip';
import type { PostReaction } from './ReactionChip';
import { filterEmojis, groupEmojis, matchesTerms, searchTerms } from '../lib/unicodeEmoji';
import type { UnicodeEmoji } from '../lib/unicodeEmoji';

/** How many cells a row of the grid holds; the stylesheet draws the same number. */
export const COLUMNS = 8;

/** One custom emoji of the instance: its shortcode, its still picture and its category. */
export type PickerCustomEmoji = {
  readonly shortcode: string;
  /** The still image: the picker never animates. */
  readonly url: string;
  readonly category: string | null;
};

/** What the picker draws besides the post's own reactions. */
export type PickerData = {
  readonly custom: readonly PickerCustomEmoji[];
  /** The Unicode emoji; null while they are still loading. */
  readonly unicode: readonly UnicodeEmoji[] | null;
};

/** One button of the grid. */
export type Cell = {
  readonly key: string;
  /** The accessible name: the Unicode name, or `:shortcode:`. */
  readonly name: string;
  /** What `/react` is given: the character or `:shortcode:`. */
  readonly choose: string;
  /** True when choosing it takes the viewer's reaction back. */
  readonly remove: boolean;
  /** The text drawn when there is no picture. */
  readonly glyph: string;
  /** The picture drawn instead of the glyph, when there is an https one. */
  readonly image: string | null;
  /** Whether the viewer's own reaction is on, for a reaction; undefined for a plain emoji. */
  readonly pressed: boolean | undefined;
};

/** A headed run of cells, or a note where there are none yet. */
export type Section = {
  readonly id: string;
  readonly title: string;
  /** The grid index of the section's first cell. */
  readonly start: number;
  readonly cells: readonly Cell[];
  readonly note: string | null;
};

/** A section before its cells are numbered. */
type Draft = Omit<Section, 'start'>;

/** A cell for an emoji that is only a name, a picture and the text it sends. */
function plainCell(key: string, name: string, picture: string | null): Cell {
  const image = picture !== null && isHttps(picture) ? picture : null;
  return { key, name, choose: name, remove: false, glyph: name, image, pressed: undefined };
}

/** The cell of one Unicode emoji: its Unicode name names it, its character is sent. */
function emojiCell(one: UnicodeEmoji): Cell {
  return {
    ...plainCell(`emoji:${one.emoji}`, one.name, null),
    choose: one.emoji,
    glyph: one.emoji,
  };
}

/** The cell of one of the post's reactions: choosing it toggles the viewer's own. */
function reactionCell(reaction: PostReaction): Cell {
  const name = reaction.url === null ? reaction.name : `:${shortcodeOf(reaction.name)}:`;
  return {
    ...plainCell(`reaction:${reaction.name}`, name, reaction.url),
    remove: reaction.me,
    pressed: reaction.me,
  };
}

/**
 * The words a search can find a reaction by: its own name and, once the
 * Unicode emoji have loaded, the name and keywords of the emoji it is.
 */
function reactionWords(cell: Cell, unicode: PickerData['unicode']): readonly string[] {
  const known = unicode?.find((one) => one.emoji === cell.choose);
  return known === undefined ? [cell.name] : [cell.name, known.name, ...known.keywords];
}

/** The custom emoji under {@link terms}, by category in order of appearance, none last. */
function customDrafts(custom: readonly PickerCustomEmoji[], terms: readonly string[]): Draft[] {
  const shown = custom.filter((one) => matchesTerms(terms, [one.shortcode, one.category ?? '']));
  const categories = [
    ...new Set(shown.flatMap((one) => (one.category === null ? [] : [one.category]))),
  ];
  return [...categories, null].map((category) => ({
    id: `custom:${category ?? ''}`,
    title: category === null ? 'custom' : `custom: ${category}`,
    cells: shown
      .filter((one) => one.category === category)
      .map((one) => plainCell(`custom:${one.shortcode}`, `:${one.shortcode}:`, one.url)),
    note: null,
  }));
}

/** The Unicode emoji under {@link query} by group, or the loading note while they are not here. */
function unicodeDrafts(unicode: PickerData['unicode'], query: string): Draft[] {
  if (unicode === null) {
    return [{ id: 'emoji', title: 'emoji', cells: [], note: 'loading…' }];
  }
  return groupEmojis(filterEmojis(unicode, query)).map((group) => ({
    id: `emoji:${group.key}`,
    title: `emoji: ${group.title}`,
    cells: group.emojis.map((one) => emojiCell(one)),
    note: null,
  }));
}

/**
 * The picker's sections for {@link query}: the post's reactions, the custom
 * emoji, then the Unicode ones; a section with nothing to show is left out.
 */
export function pickerSections(
  source: PickerData & { readonly reactions: readonly PostReaction[] },
  query: string,
): readonly Section[] {
  const terms = searchTerms(query);
  const own = source.reactions
    .map(reactionCell)
    .filter((cell) => matchesTerms(terms, reactionWords(cell, source.unicode)));
  const drafts: Draft[] = [
    { id: 'post', title: 'on this post', cells: own, note: null },
    ...customDrafts(source.custom, terms),
    ...unicodeDrafts(source.unicode, query),
  ];
  const sections: Section[] = [];
  let start = 0;
  for (const draft of drafts.filter((one) => one.cells.length > 0 || one.note !== null)) {
    sections.push({ ...draft, start });
    start += draft.cells.length;
  }
  return sections;
}

/**
 * Where a navigation key moves the focus in a grid of {@link count} cells from
 * {@link active}: a cell index, a negative one above the first row (the search
 * field), or null when the key does not navigate.
 */
export function gridTarget(key: string, active: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return Math.min(active + 1, count - 1);
    case 'ArrowLeft':
      return Math.max(active - 1, 0);
    case 'ArrowDown':
      return Math.min(active + COLUMNS, count - 1);
    case 'ArrowUp':
      return active < COLUMNS ? -1 : active - COLUMNS;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
