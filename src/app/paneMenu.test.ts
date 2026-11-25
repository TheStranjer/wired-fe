/**
 * Tests for the pane split menu's item list (WFE-229): which rows a registry
 * and the saved feeds give, in order, and the command line each row runs.
 */
import { describe, expect, it } from 'vitest';

import { askedLine, entryLine, paneMenuEntries, popOutEntries } from './paneMenu';
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
    { id: 'feed-new', command: 'split', line: '/feed new', prefill: false },
    { id: 'tag', command: 'vsplit', line: '/vsplit tag', prefill: false },
    { id: 'search', command: 'split', line: '/split search', prefill: false },
    { id: 'whois', command: 'vsplit', line: '/vsplit whois', prefill: false },
    { id: 'dm', command: 'split', line: '/split dm', prefill: false },
    { id: 'people', command: 'vsplit', line: '/people', prefill: false },
    { id: 'people', command: 'split', line: '/people', prefill: false },
    { id: 'win', command: 'vsplit', line: '/vsplit win', prefill: true },
    { id: 'home', command: 'float', line: '/float home', prefill: false },
    { id: 'tag', command: 'float', line: '/float tag', prefill: false },
  ] as const)('$id from $command is $line', ({ id, command, line, prefill }) => {
    const found = entry(entries, id);

    expect(entryLine(found, command)).toBe(line);
    expect(found.prefill).toBe(prefill);
  });
});

describe('the asking rows', () => {
  const entries = paneMenuEntries(ALL, FEEDS);

  it.each([
    { id: 'tag', title: 'Split with hashtag', placeholder: '#tag', suggest: 'tags' },
    { id: 'search', title: 'Search', placeholder: 'words, @account or #tag', suggest: null },
    { id: 'whois', title: 'Open profile', placeholder: '@user@instance', suggest: 'accounts' },
    { id: 'dm', title: 'Direct message', placeholder: '@user@instance', suggest: 'accounts' },
  ] as const)('$id asks $title and does not prefill', ({ id, ...ask }) => {
    const found = entry(entries, id);

    expect(found.ask).toStrictEqual(ask);
    expect(found.prefill).toBe(false);
  });

  it('leaves Existing window… as the one row that still prefills', () => {
    const prefilling = entries.filter((candidate) => candidate.prefill);

    expect(prefilling.map((candidate) => candidate.id)).toStrictEqual(['win']);
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

describe(popOutEntries, () => {
  it('puts This pane, which runs /float, where Same window was', () => {
    const popped = popOutEntries(paneMenuEntries(ALL, []));

    expect(popped.map((item) => item.id)).not.toContain('same');
    expect(popped[0]?.label).toBe('This pane');
    expect(popped[0] === undefined ? '' : entryLine(popped[0], 'float')).toBe('/float');
    expect(popped.map((item) => item.id)).toContain('home');
  });
});
