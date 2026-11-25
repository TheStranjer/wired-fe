/**
 * Keyboard events and user-written bindings -> canonical chord strings.
 *
 * A chord is `[Ctrl+][Alt+][Shift+][Meta+]<key>`: modifiers in exactly that
 * order, joined with `+`. Letters are lowercase and carry `Shift+` when Shift is
 * held; a character such as `?` already shows Shift, so it never carries it
 * (`?`, not `Shift+/`); named keys keep the casing of `KeyboardEvent.key`, and
 * the space bar is `Space`. The keymap compares these strings. With Alt held,
 * the bracket keys are named by `KeyboardEvent.code`, since macOS Option turns
 * `event.key` into `“` or `‘`: `Alt+[` and `Alt+]` on every layout.
 *
 * The forgiving grammar of the binding text itself lives in ./bindingText.
 * `blocksTyping` is the one rule over a finished chord the keymap and the
 * `/bind` commands share: a plain character cannot be bound in insert mode.
 *
 * Pure: no listeners and no keymap here, only these conversions and that rule.
 */

import { bindingParts } from './bindingText';

/** The fields of a KeyboardEvent this module reads. */
export type KeyLike = {
  readonly key: string;
  /** The physical key (`KeyboardEvent.code`); read only for Alt+bracket. */
  readonly code?: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
};

/** A modifier, spelled as a canonical chord spells it. */
export type Modifier = 'Ctrl' | 'Alt' | 'Shift' | 'Meta';

/** The key of a chord: how it is spelled, and whether Shift is written with it. */
type KeyPart = {
  readonly name: string;
  /** True for letters, named keys and Space; false for characters like `?`. */
  readonly shiftMatters: boolean;
};

/** The modifiers, in the order a canonical chord writes them. */
const MODIFIERS: readonly Modifier[] = ['Ctrl', 'Alt', 'Shift', 'Meta'];

/** Bindable named keys, spelled as `KeyboardEvent.key` spells them, plus Space. */
const NAMED_KEYS: readonly string[] = [
  'Enter',
  'Escape',
  'Tab',
  'Backspace',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Insert',
  'Space',
  ...Array.from({ length: 12 }, (_, index): string => `F${String(index + 1)}`),
];

/** Named keys by lowercased name, so bindings match them case-insensitively. */
const NAMED_KEYS_BY_NAME: ReadonlyMap<string, string> = new Map(
  NAMED_KEYS.map((name): [string, string] => [name.toLowerCase(), name]),
);

/** A single ASCII letter, either case. */
const LETTER = /^[a-z]$/iu;

/** The keys read by `code` when Alt is held, because Alt changes what `key` says. */
const ALT_CODE_KEYS: ReadonlyMap<string, string> = new Map([
  ['BracketLeft', '['],
  ['BracketRight', ']'],
]);

/** A control character, which is never a printable key. */
const CONTROL_CHARACTER = /\p{Cc}/u;

/** What joins the chords of a binding sequence, canonically one space. */
const SEQUENCE_SEPARATOR = ' ';

/** Everything after the first chord of a canonical sequence, separator included. */
const FOLLOWING_CHORDS = / .*$/u;

/** The `Shift+` a canonical chord may carry in front of its key. */
const SHIFT_PREFIX = 'Shift+';

/**
 * Turns a keyboard event into the canonical chord it names, or `null` when it is
 * a bare modifier, `Dead`, `Unidentified` or a named key that cannot be bound.
 */
export function chordFromEvent(event: KeyLike): string | null {
  const part = keyPart(eventKey(event));
  if (part === null) {
    return null;
  }
  return formatChord(modifiersFromEvent(event), part);
}

/**
 * Turns user-written binding text such as `ctrl+e`, ` Alt + 1 `, `escape` or `?`
 * into the canonical chord it names, or `null` when the text is empty, names an
 * unknown key, repeats a modifier, or holds modifiers without a key.
 */
export function parseChord(text: string): string | null {
  const parts = bindingParts(text);
  if (parts === null) {
    return null;
  }
  const part = keyPart(parts.key);
  if (part === null) {
    return null;
  }
  return formatChord(parts.modifiers, part);
}

/**
 * Turns user-written binding text of one or more chords (`w v`, `ctrl+b %`) into
 * the canonical sequence it names: each chord canonical, joined by single
 * spaces. Returns `null` when the text is empty or any chord is unparsable.
 * A single chord stays a one-chord sequence, so old bindings keep working.
 */
export function parseSequence(text: string): string | null {
  const chords = text.trim().split(/\s+/u).map(parseChord);
  return chords.includes(null) ? null : chords.join(SEQUENCE_SEPARATOR);
}

/**
 * Whether the canonical {@link chord} swallows typing: its plain key is a
 * single character, so binding it in insert mode would eat the very keystroke
 * the reader meant to type. Named keys and chords carrying Ctrl, Alt or Meta
 * never do. The keymap refuses such bindings, and `/bind` refuses to make one
 * (AGENTS.md "Two hotkey modes", WFE-130).
 */
export function blocksTyping(sequence: string): boolean {
  const chord = sequence.replace(FOLLOWING_CHORDS, '');
  const plain = chord.startsWith(SHIFT_PREFIX) ? chord.slice(SHIFT_PREFIX.length) : chord;
  return plain.length === 1;
}

/**
 * The canonical part for a key name or character, or `null` when the key cannot
 * be bound: bare modifiers, `Dead`, `Unidentified` and any multi-character name
 * outside {@link NAMED_KEYS} all end up there.
 */
function keyPart(key: string): KeyPart | null {
  if (key === ' ') {
    return { name: 'Space', shiftMatters: true };
  }
  const named = NAMED_KEYS_BY_NAME.get(key.toLowerCase());
  if (named !== undefined) {
    return { name: named, shiftMatters: true };
  }
  if (LETTER.test(key)) {
    return { name: key.toLowerCase(), shiftMatters: true };
  }
  if (key.length === 1 && !CONTROL_CHARACTER.test(key)) {
    return { name: key, shiftMatters: false };
  }
  return null;
}

/** The key name of {@link event}: its `key`, except Alt+bracket, which `code` names. */
function eventKey(event: KeyLike): string {
  const fromCode =
    event.altKey && event.code !== undefined ? ALT_CODE_KEYS.get(event.code) : undefined;
  return fromCode ?? event.key;
}

/** The modifiers an event holds. Shift is dropped later when the key hides it. */
function modifiersFromEvent(event: KeyLike): ReadonlySet<Modifier> {
  const held = new Set<Modifier>();
  if (event.ctrlKey) {
    held.add('Ctrl');
  }
  if (event.altKey) {
    held.add('Alt');
  }
  if (event.shiftKey) {
    held.add('Shift');
  }
  if (event.metaKey) {
    held.add('Meta');
  }
  return held;
}

/** Writes the canonical chord: modifiers in fixed order, then the key. */
function formatChord(modifiers: ReadonlySet<Modifier>, part: KeyPart): string {
  const prefix = MODIFIERS.filter(
    (modifier) => modifiers.has(modifier) && (modifier !== 'Shift' || part.shiftMatters),
  )
    .map((modifier) => `${modifier}+`)
    .join('');
  return `${prefix}${part.name}`;
}
