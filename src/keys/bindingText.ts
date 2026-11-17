/**
 * The forgiving grammar of binding text a reader writes (WFE-130): what
 * `ctrl+e`, ` Alt + 1 ` or `?` says, split into the set of modifiers it names
 * and the key token — the alias table and the `+` rules live here, and
 * ./chord turns the two parts into the canonical chord. Pure: no events, no
 * keymap, no I/O.
 */

import type { Modifier } from './chord';

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

/** Binding text read: the modifiers it names and the key token beside them. */
export type BindingParts = {
  readonly modifiers: ReadonlySet<Modifier>;
  readonly key: string;
};

/** The modifiers the leading {@link tokens} name beside {@link key}, or null if one is unknown or twice. */
function withModifiers(tokens: readonly string[], key: string): BindingParts | null {
  const held = new Set<Modifier>();
  for (const token of tokens) {
    const modifier = MODIFIER_ALIASES[token.toLowerCase()];
    if (modifier === undefined || held.has(modifier)) {
      return null;
    }
    held.add(modifier);
  }
  return { modifiers: held, key };
}

/**
 * Split {@link text} on `+`, trimming every part, and read the modifier
 * tokens through the alias table. The joiner and the `+` key are the same
 * character, so `ctrl++` is Ctrl with the `+` key, while one trailing `+`
 * (`ctrl+`) leaves a binding without a key. Returns null when the text holds
 * no key token, names an unknown modifier or repeats one.
 */
export function bindingParts(text: string): BindingParts | null {
  const parts = text.split('+').map((part) => part.trim());
  const key = parts.pop();
  if (key === '' && parts.at(-1) === '') {
    parts.pop();
    return withModifiers(parts, '+');
  }
  if (key === undefined || key === '') {
    return null;
  }
  return withModifiers(parts, key);
}
