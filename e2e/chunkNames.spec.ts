/**
 * The names of the built files (WFE-335): every emitted script, the entry and
 * the lazy emoji and language chunks alike, starts with `wired.`, so the
 * hosting rule that maps `/<any path>/wired.<hash>.*` back to `dist/` also
 * answers the chunk a page at a nested path (`/oauth/authorize`,
 * `/notice/<id>`) asks for.
 */

import { readdirSync } from 'node:fs';

import { expect, test } from '@playwright/test';

/** Every `.js` file under `dist/`, by path relative to it. */
function emittedScripts(): readonly string[] {
  return readdirSync('dist', { recursive: true, encoding: 'utf8' }).filter((file) =>
    file.endsWith('.js'),
  );
}

test('every emitted script is named wired.<something>', () => {
  const scripts = emittedScripts();

  expect(scripts.length).toBeGreaterThan(1);
  expect(scripts.filter((file) => !file.startsWith('wired.'))).toStrictEqual([]);
});

test('the emoji list and every language are chunks of their own under that rule', () => {
  const scripts = emittedScripts();

  expect(scripts.some((file) => /^wired\.emoji\.[^.]+\.js$/u.test(file))).toBe(true);
  expect(scripts.some((file) => /^wired\.locale\.[^.]+\.js$/u.test(file))).toBe(true);
});
