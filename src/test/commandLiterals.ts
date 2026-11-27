/**
 * The check behind "literals belong in arguments" (decision 19, WFE-336):
 * which command words a message of the English source carries as plain text.
 * A subcommand word (`now`), a setting value (`vsplit`) or a feed source
 * (`mentions`) that the reader types must reach a message as an ICU argument,
 * because Prism translates the text of a message and a translated `now` is a
 * word the parser does not accept. A word counts as bare when it follows a
 * `/command` or `--flag` with only such words between, or when three or more
 * of them stand in one list. Arguments, quoted `'<…>'` text and prose that
 * merely contains the word (`log in with it now`) do not count.
 */
import { PLAIN_SOURCES } from '../state/feeds';
import { PLACEMENTS } from '../state/placement';
import { CLOCK_FORMATS, DENSITIES, THEMES, VISIBILITIES } from '../state/settings';

/** Subcommand and `/set`, `/display` words that are not an enum of the settings. */
const SUBCOMMANDS = [
  'add',
  'rm',
  'new',
  'edit',
  'prune',
  'reset',
  'now',
  'on',
  'off',
  'primary',
  'fallback',
  'density',
  'avatars',
  'images',
  'list',
  'move',
  'size',
  'next',
  'prev',
  'auto',
  'default',
  'clear',
] as const;

/** Every word the reader types after a command that a message must not hold as text. */
const LITERALS: ReadonlySet<string> = new Set<string>([
  ...SUBCOMMANDS,
  ...PLACEMENTS,
  ...DENSITIES,
  ...THEMES,
  ...VISIBILITIES,
  ...CLOCK_FORMATS,
  ...PLAIN_SOURCES,
]);

/** How many literals in one list make it a list of command words rather than a coincidence. */
const LIST_LENGTH = 3;

/** An ICU argument with nothing nested in it. */
const ARGUMENT = /\{[^{}]*\}/gu;

/** ICU-quoted text such as `'<handle>'`. */
const QUOTED = /'[<{][^']*'/gu;

/** What a token of a message is for the check. */
type Kind = 'command' | 'literal' | 'connector' | 'other';

/** One word of a message: its text without edge punctuation, what it is, and whether a sentence part ends on it. */
type Piece = { readonly word: string; readonly kind: Kind; readonly ends: boolean };

/** {@link text} with every ICU argument, nested ones too, replaced by a space. */
function withoutArguments(text: string): string {
  const next = text.replace(ARGUMENT, ' ');
  return next === text ? text : withoutArguments(next);
}

/** Whether {@link part} is one command literal, or a source such as `*:home` or `tag:rust`. */
function isLiteral(part: string): boolean {
  return (
    LITERALS.has(part) ||
    /(?:^|:)tag:/u.test(part) ||
    (part.includes(':') && LITERALS.has(part.slice(part.lastIndexOf(':') + 1)))
  );
}

/** What {@link word} is: a `/command` or `--flag`, a literal or an `a|b` list of them, `and`/`or`, or anything else. */
function kindOf(word: string): Kind {
  if (/^(?:\/|--)[a-z]+$/u.test(word)) {
    return 'command';
  }
  if (word === 'and' || word === 'or') {
    return 'connector';
  }
  return word.split('|').every(isLiteral) ? 'literal' : 'other';
}

/** The tokens of {@link message} outside its arguments. */
function piecesOf(message: string): readonly Piece[] {
  const text = withoutArguments(message.replace(QUOTED, ' '));
  return text
    .split(/\s+/u)
    .filter((raw) => raw !== '')
    .map((raw) => {
      const word = raw.replace(/^[([]+|[.,;:!?)\]…]+$/gu, '');
      return { word, kind: kindOf(word), ends: /[.;:)]$/u.test(raw) };
    });
}

/** The pieces of {@link list} grouped into runs of command, literal and connector words that nothing else interrupts. */
function runsOf(list: readonly Piece[]): readonly (readonly Piece[])[] {
  const groups: Piece[][] = [];
  let current: Piece[] | null = null;
  for (const piece of list) {
    if (piece.kind === 'other') {
      current = null;
    } else {
      const run: Piece[] = current ?? [];
      if (current === null) {
        groups.push(run);
      }
      run.push(piece);
      current = piece.ends ? null : run;
    }
  }
  return groups;
}

/** The literal words of {@link pieces}, `a|b` lists split. */
function wordsOf(pieces: readonly Piece[]): readonly string[] {
  return pieces.filter((piece) => piece.kind === 'literal').flatMap((p) => p.word.split('|'));
}

/**
 * The literals of {@link run}: those after a `/command` or `--flag` in it
 * (words before it are prose that ran up to the command), or all of them
 * when there are enough to make a list.
 */
function flagged(run: readonly Piece[]): readonly string[] {
  const all = wordsOf(run);
  const afterCommand = wordsOf(run.slice(run.findIndex((piece) => piece.kind === 'command')));
  const typed = run.some((piece) => piece.kind === 'command') ? afterCommand : [];
  return new Set(all).size >= LIST_LENGTH ? all : typed;
}

/**
 * The command literals {@link message} holds as plain text, in order and
 * without repeats; empty when every literal arrives as an argument.
 */
export function bareLiterals(message: string): readonly string[] {
  return [...new Set(runsOf(piecesOf(message)).flatMap(flagged))];
}
