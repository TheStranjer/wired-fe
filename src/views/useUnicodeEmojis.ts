/**
 * The Unicode emoji of the picker (WFE-265): the `emojibase-data` English
 * compact list, about half a megabyte of JSON, is brought in by a dynamic
 * `import()` the first time a picker is opened, so it ships as a chunk of its
 * own and not in the main bundle. It is adapted once (src/lib/unicodeEmoji)
 * and kept for the life of the module; until it is here the hook answers null,
 * which the picker shows as `loading…`.
 */
import { useEffect, useState } from 'react';

import { adaptEmojis } from '../lib/unicodeEmoji';
import type { UnicodeEmoji } from '../lib/unicodeEmoji';

/** The adapted list, once it has arrived. */
let loaded: readonly UnicodeEmoji[] | null = null;

/** The request in flight, so every picker waits for the one import. */
let loading: Promise<readonly UnicodeEmoji[]> | null = null;

/** The list: the one already here, the import already running, or a fresh import. */
async function load(): Promise<readonly UnicodeEmoji[]> {
  loading ??= import('emojibase-data/en/compact.json').then((module) => {
    loaded = adaptEmojis(module.default);
    return loaded;
  });
  return loading;
}

/**
 * The Unicode emoji, or null while they load. Nothing is fetched until
 * {@link wanted} is true, and a list that has arrived is there from the first
 * render of every hook after it.
 */
export function useUnicodeEmojis(wanted: boolean): readonly UnicodeEmoji[] | null {
  const [emojis, setEmojis] = useState(loaded);
  useEffect(() => {
    if (!wanted) {
      return;
    }
    let listening = true;
    void load().then((list) => {
      if (listening) {
        setEmojis(list);
      }
    });
    return () => {
      listening = false;
    };
  }, [wanted]);
  return emojis;
}
