/**
 * Tests for the shipped reply keys (WFE-244), over the real command registry:
 * in navigation mode `r` still fills `/reply` with the selected post's label
 * for a one-line answer, `Shift+r` runs `/reply` on the selection — which
 * opens the composer — and `q`, which `/quote` moved to, is free of both; no
 * default binding is refused for a clash.
 */
import { describe, expect, it } from 'vitest';

import { buildKeymap } from './keymap';
import { loadDefinitions } from '../commands/definitions';
import { buildRegistry } from '../commands/registry';

/** The keymap of every real command's default bindings. */
function realKeymap(): ReturnType<typeof buildKeymap> {
  const loaded = loadDefinitions();
  if (!loaded.ok) {
    throw new Error(loaded.error);
  }
  const built = buildRegistry(loaded.value);
  if (!built.ok) {
    throw new Error(built.error);
  }
  return buildKeymap(built.value);
}

describe('the shipped reply keys', () => {
  it('prefills the line on r and runs the composer on Shift+r', () => {
    const { navigation } = realKeymap();

    expect(navigation.get('r')).toStrictEqual({ line: '/reply {label}', prefill: true });
    expect(navigation.get('Shift+r')).toStrictEqual({ line: '/reply', prefill: false });
  });

  it('moved quote to q so Shift+r is reply’s alone', () => {
    expect(realKeymap().navigation.get('q')).toStrictEqual({
      line: '/quote {label}',
      prefill: true,
    });
  });

  it('refuses no default binding', () => {
    expect(realKeymap().problems).toStrictEqual([]);
  });
});
