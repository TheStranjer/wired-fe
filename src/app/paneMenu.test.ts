/**
 * Tests for the pane split menu's item list (WFE-229): which rows a registry
 * and the saved feeds give, in order, and the command line each row runs.
 */
import { describe, expect, it } from 'vitest';

import { askedLine, entryLine, paneMenuEntries } from './paneMenu';
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

describe('the Attach media… row', () => {
  const withAttach = registryOf('home', 'attach');

  it('comes last, set apart, and runs /attach whole from every button', () => {
    const entries = paneMenuEntries(withAttach, []);
    const last = entries.at(-1);

    expect(last?.id).toBe('attach');
    expect(last?.label).toBe('Attach media…');
    expect(last?.separated).toBe(true);
    expect(entries.filter((candidate) => candidate.separated === true)).toHaveLength(1);

    for (const command of ['vsplit', 'split', 'float'] as const) {
      expect(last === undefined ? '' : entryLine(last, command)).toBe('/attach');
    }
  });

  it('is left out when the registry has no /attach', () => {
    expect(paneMenuEntries(ALL, FEEDS).map((item) => item.id)).not.toContain('attach');
  });
});

describe('the Existing window… row', () => {
  it('is a window picker, not a prefill, and no other row is a picker', () => {
    const entries = paneMenuEntries(ALL, FEEDS);

    expect(entry(entries, 'win').pick).toBe('window');
    expect(entry(entries, 'win').ask).toBeNull();
    expect(entries.filter((candidate) => candidate.pick !== null)).toHaveLength(1);
  });
});

describe(entryLine, () => {
  const entries = paneMenuEntries(ALL, FEEDS);

  it.each([
    { id: 'same', command: 'vsplit', line: '/vsplit' },
    { id: 'same', command: 'split', line: '/split' },
    { id: 'home', command: 'vsplit', line: '/vsplit home' },
    { id: 'composer', command: 'split', line: '/split composer' },
    { id: 'feed:f2', command: 'vsplit', line: '/vsplit feed night owls' },
    { id: 'feed-new', command: 'split', line: '/feed new' },
    { id: 'tag', command: 'vsplit', line: '/vsplit tag' },
    { id: 'search', command: 'split', line: '/split search' },
    { id: 'whois', command: 'vsplit', line: '/vsplit whois' },
    { id: 'dm', command: 'split', line: '/split dm' },
    { id: 'people', command: 'vsplit', line: '/people' },
    { id: 'people', command: 'split', line: '/people' },
    { id: 'win', command: 'vsplit', line: '/vsplit win' },
    { id: 'home', command: 'float', line: '/float home' },
    { id: 'tag', command: 'float', line: '/float tag' },
  ] as const)('$id from $command is $line', ({ id, command, line }) => {
    expect(entryLine(entry(entries, id), command)).toBe(line);
  });
});

describe('the asking rows', () => {
  const entries = paneMenuEntries(ALL, FEEDS);

  it.each([
    { id: 'tag', title: 'Split with hashtag', placeholder: '#tag', suggest: 'tags' },
    { id: 'search', title: 'Search', placeholder: 'words, @account or #tag', suggest: null },
    { id: 'whois', title: 'Open profile', placeholder: '@user@instance', suggest: 'accounts' },
    { id: 'dm', title: 'Direct message', placeholder: '@user@instance', suggest: 'accounts' },
  ] as const)('$id asks $title', ({ id, ...ask }) => {
    expect(entry(entries, id).ask).toStrictEqual(ask);
  });

  it('has exactly four asking rows', () => {
    expect(entries.filter((candidate) => candidate.ask !== null)).toHaveLength(4);
  });
});

describe(askedLine, () => {
  const entries = paneMenuEntries(ALL, FEEDS);

  it.each([
    { id: 'tag', command: 'vsplit', answer: 'rust', line: '/vsplit tag rust' },
    { id: 'tag', command: 'split', answer: ' #Rust ', line: '/split tag Rust' },
    { id: 'search', command: 'float', answer: ' #lain @bob ', line: '/float search #lain @bob' },
    {
      id: 'whois',
      command: 'split',
      answer: '@alice@mastodon.test',
      line: '/split whois @alice@mastodon.test',
    },
    {
      id: 'whois',
      command: 'vsplit',
      answer: 'alice@mastodon.test',
      line: '/vsplit whois @alice@mastodon.test',
    },
    { id: 'dm', command: 'float', answer: 'bob@wired2.test', line: '/float dm @bob@wired2.test' },
    { id: 'home', command: 'vsplit', answer: 'x', line: '/vsplit home x' },
  ] as const)('$id from $command answered $answer is $line', ({ id, command, answer, line }) => {
    expect(askedLine(entry(entries, id), command, answer)).toBe(line);
  });
});
