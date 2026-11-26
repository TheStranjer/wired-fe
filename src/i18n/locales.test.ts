/**
 * The check over every file in `locales/`: valid JSON, plain nested objects
 * of strings, every message parses as ICU. Target languages lag the source
 * until Prism runs and the runtime falls back to English, so nothing here
 * asks them to hold every key or the source's arguments; the source's own
 * conventions (`lower_snake` keys, alphabetical) are checked on `en.json`.
 */
import { describe, expect, it } from 'vitest';

import { parseMessage } from './formatters';

/** Every catalog file's text by path. */
const FILES: Readonly<Record<string, string>> = import.meta.glob<string>('./locales/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The language a path `./locales/<language>.json` holds. */
function languageOf(path: string): string {
  return path.replace(/^.*\//u, '').replace(/\.json$/u, '');
}

/** What is wrong with {@link node} and below, as one line each; empty when nothing is. */
function problems(node: unknown, path: string, language: string): readonly string[] {
  if (typeof node === 'string') {
    return parseMessage(node, language) === null ? [`${path}: not an ICU message`] : [];
  }
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return [`${path}: not an object or a string`];
  }
  return Object.entries(node).flatMap(([name, value]) =>
    problems(value, path === '' ? name : `${path}.${name}`, language),
  );
}

/** Every key of {@link node} and below with the keys of its own object, in file order. */
function keyLists(node: unknown): readonly (readonly string[])[] {
  if (typeof node !== 'object' || node === null) {
    return [];
  }
  return [Object.keys(node), ...Object.values(node).flatMap(keyLists)];
}

describe('the locale files', () => {
  it('include the English source', () => {
    expect(Object.keys(FILES)).toContain('./locales/en.json');
  });

  describe.each(Object.entries(FILES))('%s', (path, text) => {
    it('is JSON of nested objects of ICU messages', () => {
      const parsed: unknown = JSON.parse(text);

      expect(problems(parsed, '', languageOf(path))).toStrictEqual([]);
    });
  });

  it('keeps the English keys lower_snake and alphabetical within each object', () => {
    const lists = keyLists(JSON.parse(FILES['./locales/en.json'] ?? '{}'));

    for (const keys of lists) {
      expect(keys.filter((key) => !/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/u.test(key))).toStrictEqual([]);
      expect(keys).toStrictEqual([...keys].sort());
    }
  });

  it('seeds one namespace per sweep area in the English source', () => {
    const [root = []] = keyLists(JSON.parse(FILES['./locales/en.json'] ?? '{}'));

    expect(root).toStrictEqual(
      expect.arrayContaining([
        'accounts',
        'api',
        'app',
        'commands',
        'features',
        'format',
        'keys',
        'state',
        'ui',
        'views',
        'windows',
      ]),
    );
  });
});
