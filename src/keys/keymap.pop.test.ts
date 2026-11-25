/**
 * The shipped keymap binds navigation `p` to `/pop` (WFE-241) without a
 * conflict, so the hotkey pops the selected post out into a float.
 */
import { describe, expect, it } from 'vitest';

import { buildKeymap } from './keymap';
import { loadDefinitions } from '../commands/definitions';
import { buildRegistry } from '../commands/registry';

describe('the shipped keymap', () => {
  it('binds navigation p to /pop on the selected post', () => {
    const loaded = loadDefinitions();
    const built = loaded.ok ? buildRegistry(loaded.value) : loaded;
    const keymap = built.ok ? buildKeymap(built.value) : null;

    expect(keymap?.navigation.get('p')).toStrictEqual({ line: '/pop', prefill: false });
    expect(keymap?.problems).toStrictEqual([]);
  });
});
