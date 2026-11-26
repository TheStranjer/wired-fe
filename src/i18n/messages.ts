/**
 * The shapes of a message catalog (decision 19): the source catalog's typed
 * keys and the flattening of a nested catalog into dot paths. Pure; nothing
 * here knows the active language.
 */

import type english from './locales/en.json';
import { isRecord } from '../lib/guards';

/** A nested catalog as the JSON files hold it: objects of objects of messages. */
export type Messages = { readonly [key: string]: string | Messages };

/** The dot paths of every message in {@link T}. */
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

/** Every message key of the English source, e.g. `commands.not_signed_in_as`. */
export type MessageKey = Paths<typeof english>;

/** The values a message's arguments take. */
export type MessageValues = Readonly<Record<string, string | number>>;

/** The shape of `t()` and of what `useT()` returns, for helpers a component hands its `t`. */
export type Translate = (key: MessageKey, values?: MessageValues) => string;

/** Put the messages of {@link node}, an unknown parsed JSON value, into {@link into} under {@link prefix}. */
function collect(node: unknown, prefix: string, into: Map<string, string>): void {
  if (!isRecord(node) || Array.isArray(node)) {
    return;
  }
  for (const [name, value] of Object.entries(node)) {
    if (typeof value === 'string') {
      into.set(`${prefix}${name}`, value);
    } else {
      collect(value, `${prefix}${name}.`, into);
    }
  }
}

/**
 * The messages of an unknown parsed JSON catalog as dot paths: strings are
 * kept, objects are entered, anything else is dropped.
 */
export function flatten(catalog: unknown): ReadonlyMap<string, string> {
  const flat = new Map<string, string>();
  collect(catalog, '', flat);
  return flat;
}
