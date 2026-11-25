/**
 * Tests for the pane split menu's item list (WFE-229): which rows a registry
 * and the saved feeds give, in order, and the command line each row runs.
 */
import { describe, expect, it } from 'vitest';

import { entryLine, paneMenuEntries } from './paneMenu';
import type { PaneMenuEntry } from './paneMenu';
import { OK } from '../commands/outcome';
import { buildRegistry } from '../commands/registry';
import type { Registry } from '../commands/types';
import type { Feeds } from '../state/feeds';

/** A registry holding commands called {@link names}, each of which does nothing. */
function registryOf(...names: readonly string[]): Registry {
  const built = buildRegistry(
    names.map((name) => ({
      name,
      usage: `/${name}`,
      summary: name,
      run: async () => await Promise.resolve(OK),
    })),
  );
  if (!built.ok) {
    throw new Error(built.error);
  }
  return built.value;
}

const ALL = registryOf(
  'composer',
  'home',
  'notifications',
  'local',
  'federated',
  'dms',
  'people',
  'tag',
  'search',
  'whois',
  'query',
  'win',
  'feed',
);

const FEEDS: Feeds = [
  { id: 'f1', name: 'main', sources: [] },
  { id: 'f2', name: 'night owls', sources: [] },
];

/** The entry with id {@link id}. */
function entry(entries: readonly PaneMenuEntry[], id: string): PaneMenuEntry {
  const found = entries.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`no entry ${id}`);
  }
  return found;
}

describe(paneMenuEntries, () => {
  it('lists every view in order, saved feeds after Same window', () => {
    const labels = paneMenuEntries(ALL, FEEDS).map((item) => item.label);

    expect(labels).toStrictEqual([
      'Same window',
      'Feed: main',
      'Feed: night owls',
      'New feed…',
      'Composer',
      'Home',
      'Notifications',
      'Local',
      'Federated',
      'Direct messages',
      'People here',
      'Hashtag…',
      'Search…',
      'Profile…',
      'DM…',
      'Existing window…',
    ]);
  });

  it('offers New feed… but no feed rows while none is saved', () => {
    const labels = paneMenuEntries(ALL, []).map((item) => item.label);

    expect(labels).toContain('New feed…');
    expect(labels.filter((label) => label.startsWith('Feed:'))).toStrictEqual([]);
  });

  it('leaves out every feed row without the feed command', () => {
    const labels = paneMenuEntries(registryOf('home'), FEEDS).map((item) => item.label);

    expect(labels).toStrictEqual(['Same window', 'Home']);
  });

  it('leaves out the views whose command the backend lacks', () => {
    const labels = paneMenuEntries(registryOf('home', 'whois'), []).map((item) => item.label);

    expect(labels).toStrictEqual(['Same window', 'Home', 'Profile…']);
  });

  it('keeps Same window with no commands at all', () => {
    expect(paneMenuEntries(registryOf(), FEEDS).map((item) => item.id)).toStrictEqual(['same']);
  });
});

describe(entryLine, () => {
  const entries = paneMenuEntries(ALL, FEEDS);

  it.each([
    { id: 'same', command: 'vsplit', line: '/vsplit', prefill: false },
    { id: 'same', command: 'split', line: '/split', prefill: false },
    { id: 'home', command: 'vsplit', line: '/vsplit home', prefill: false },
    { id: 'composer', command: 'split', line: '/split composer', prefill: false },
    { id: 'feed:f2', command: 'vsplit', line: '/vsplit feed night owls', prefill: false },
    { id: 'feed-new', command: 'split', line: '/feed new', prefill: true },
    { id: 'tag', command: 'vsplit', line: '/vsplit tag', prefill: true },
    { id: 'search', command: 'split', line: '/split search', prefill: true },
    { id: 'whois', command: 'vsplit', line: '/vsplit whois @', prefill: true },
    { id: 'dm', command: 'split', line: '/split dm @', prefill: true },
    { id: 'people', command: 'vsplit', line: '/people', prefill: false },
    { id: 'people', command: 'split', line: '/people', prefill: false },
    { id: 'win', command: 'vsplit', line: '/vsplit win', prefill: true },
  ] as const)('$id from $command is $line', ({ id, command, line, prefill }) => {
    const found = entry(entries, id);

    expect(entryLine(found, command)).toBe(line);
    expect(found.prefill).toBe(prefill);
  });
});
