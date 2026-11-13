/**
 * Keyboard events and user-written bindings -> canonical chord strings.
 *
 * A chord is `[Ctrl+][Alt+][Shift+][Meta+]<key>`: modifiers in exactly that
 * order, joined with `+`. Letters are lowercase and carry `Shift+` when Shift is
 * held; a character such as `?` already shows Shift, so it never carries it
 * (`?`, not `Shift+/`); named keys keep the casing of `KeyboardEvent.key`, and
 * the space bar is `Space`. The keymap compares these strings.
 *
 * Pure: no listeners and no keymap here, only the two conversions.
 */

/** The fields of a KeyboardEvent this module reads. */
export type KeyLike = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
};

/** A modifier, spelled as a canonical chord spells it. */
type Modifier = 'Ctrl' | 'Alt' | 'Shift' | 'Meta';

/** The key of a chord: how it is spelled, and whether Shift is written with it. */
type KeyPart = {
  readonly name: string;
  /** True for letters, named keys and Space; false for characters like `?`. */
  readonly shiftMatters: boolean;
};

/** A binding split into its modifier tokens and its key token. */
type ChordTokens = {
  readonly modifiers: readonly string[];
  readonly key: string;
};

/** The modifiers, in the order a canonical chord writes them. */
const MODIFIERS: readonly Modifier[] = ['Ctrl', 'Alt', 'Shift', 'Meta'];

/** Names a user may write for a modifier, lowercased. */
const MODIFIER_ALIASES: Record<string, Modifier> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  super: 'Meta',
};

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

/** A control character, which is never a printable key. */
const CONTROL_CHARACTER = /\p{Cc}/u;

/**
 * Turns a keyboard event into the canonical chord it names, or `null` when it is
 * a bare modifier, `Dead`, `Unidentified` or a named key that cannot be bound.
 */
export function chordFromEvent(event: KeyLike): string | null {
  const part = keyPart(event.key);
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
  const tokens = splitChordTokens(text);
  if (tokens === null) {
    return null;
  }
  const part = keyPart(tokens.key);
  if (part === null) {
    return null;
  }
  const modifiers = parseModifierTokens(tokens.modifiers);
  if (modifiers === null) {
    return null;
  }
  return formatChord(modifiers, part);
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

/**
 * Splits binding text on `+`, trimming every part. The joiner and the `+` key
 * are the same character, so `ctrl++` is Ctrl with the `+` key, while one
 * trailing `+` (`ctrl+`) leaves a chord without a key and is refused.
 */
function splitChordTokens(text: string): ChordTokens | null {
  const parts = text.split('+').map((part) => part.trim());
  const key = parts.pop();
  if (key === '' && parts.at(-1) === '') {
    parts.pop();
    return { modifiers: parts, key: '+' };
  }
  if (key === undefined || key === '') {
    return null;
  }
  return { modifiers: parts, key };
}

/** The modifiers named by binding tokens, or `null` if one is unknown or twice. */
function parseModifierTokens(tokens: readonly string[]): ReadonlySet<Modifier> | null {
  const held = new Set<Modifier>();
  for (const token of tokens) {
    const modifier = MODIFIER_ALIASES[token.toLowerCase()];
    if (modifier === undefined || held.has(modifier)) {
      return null;
    }
    held.add(modifier);
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
