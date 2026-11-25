/**
 * Tests for the command lines behind a card's action bar: each action's line
 * names the post by label, prefill follows the command's hotkey, every
 * action names a real command, and a command the backend cannot do has none.
 */
import { describe, expect, it } from 'vitest';

import { availableCommands } from './available';
import { loadDefinitions } from './definitions';
import { postActionLines } from './postActions';
import { buildRegistry } from './registry';
import type { Registry } from './types';
import { MASTODON_CAPABILITIES, WIRED_CAPABILITIES } from '../capabilities/testCapabilities';

/** The registry of every real command. */
function realRegistry(): Registry {
  const loaded = loadDefinitions();
  if (!loaded.ok) {
    throw new Error(loaded.error);
  }
  const built = buildRegistry(loaded.value);
  if (!built.ok) {
    throw new Error(built.error);
  }
  return built.value;
}

describe(postActionLines, () => {
  it('names the post by its label in every line', () => {
    const lines = postActionLines(realRegistry(), 'a3');

    expect([lines.boost, lines.unboost]).toStrictEqual([
      { line: '/boost a3', prefill: false },
      { line: '/unboost a3', prefill: false },
    ]);
    expect([lines.fav, lines.unfav]).toStrictEqual([
      { line: '/fav a3', prefill: false },
      { line: '/unfav a3', prefill: false },
    ]);
    expect([lines.bookmark, lines.unbookmark]).toStrictEqual([
      { line: '/bookmark a3', prefill: false },
      { line: '/unbookmark a3', prefill: false },
    ]);
  });

  it('runs reply with no text, which opens a composer, although its hotkey prefills', () => {
    const lines = postActionLines(realRegistry(), 'a3');

    expect(lines.reply).toStrictEqual({ line: '/reply a3', prefill: false });
  });

  it('runs quote with no text, which opens a composer, although its hotkey prefills', () => {
    const lines = postActionLines(realRegistry(), 'a3');

    expect(lines.quote).toStrictEqual({ line: '/quote a3', prefill: false });
  });

  it('opens the emoji picker from react although its hotkey prefills', () => {
    const lines = postActionLines(realRegistry(), 'a3');

    expect(lines.react).toStrictEqual({ line: '/react a3', prefill: false, picker: true });
  });

  it('runs edit with no text, which opens a composer, although its hotkey prefills', () => {
    const lines = postActionLines(realRegistry(), 'a3');

    expect(lines.edit).toStrictEqual({ line: '/edit a3', prefill: false });
  });

  it('marks mute to open its duration dialog on click, not prefilled', () => {
    const lines = postActionLines(realRegistry(), 'a3');

    expect(lines.mute).toStrictEqual({ line: '/mute a3', prefill: false, confirm: 'mute' });
  });

  it('marks delete and block to be confirmed on click, not prefilled', () => {
    const lines = postActionLines(realRegistry(), 'a3');

    expect(lines.delete).toStrictEqual({ line: '/delete a3', prefill: false, confirm: 'delete' });
    expect(lines.block).toStrictEqual({ line: '/block a3', prefill: false, confirm: 'block' });
  });

  it('carries a line for every action when the backend does everything', () => {
    const registry = availableCommands(realRegistry(), {
      signedIn: true,
      capabilities: WIRED_CAPABILITIES,
    });

    expect(Object.keys(postActionLines(registry, 'a3'))).toHaveLength(19);
  });

  it('leaves out what the backend cannot do', () => {
    const registry = availableCommands(realRegistry(), {
      signedIn: true,
      capabilities: MASTODON_CAPABILITIES,
    });

    const lines = postActionLines(registry, 'a3');

    expect(lines.react).toBeUndefined();
    expect(lines.quote).toStrictEqual({ line: '/quote a3', prefill: false });
  });
});
