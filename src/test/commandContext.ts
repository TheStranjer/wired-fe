/**
 * The shared CommandContext stub builder (AGENTS.md "Testing"): command tests
 * get a complete context — an empty registry, a fresh initialAppState and its
 * window list, in-memory stores, the example build config and a fixed `now` —
 * and hand the callbacks they assert on in as overrides. Widening
 * CommandContext therefore only ever changes this file, not every command test.
 */
import { vi } from 'vitest';

import { TEST_DATE } from './fixtures';
import { createAccountStore } from '../accounts/accountStore';
import type { CommandContext, Registry } from '../commands/types';
import type { WiredConfig } from '../config/schema';
import { initialAppState } from '../state/appState';
import { type StorageBackend, createStore } from '../storage/store';

/** The example build-time configuration (wired.config.example.json). */
const EXAMPLE_CONFIG: WiredConfig = {
  appName: 'WIRED',
  instances: { mode: 'same-origin' },
};

/** The moment {@link fakeCommandContext}'s `now` reports: the fixtures' date. */
const FIXED_NOW = new Date(TEST_DATE);

/** The page the stub pretends to be on. */
const EXAMPLE_PAGE = { origin: 'https://wired.example', pathname: '/' };

/** The registry with no commands in it: tests override it when they need one. */
const EMPTY_REGISTRY: Registry = { commands: [], byName: new Map() };

/**
 * The pending-media stub a context carries: recorded pick and clear, nothing
 * waiting (WFE-126). {@link overrides} replaces the entries it names.
 */
export function fakeAttachments(
  overrides: Partial<CommandContext['attachments']> = {},
): CommandContext['attachments'] {
  return { pick: vi.fn(), clear: vi.fn(), pending: [], ...overrides };
}

/** An in-memory {@link StorageBackend} over a Map; nothing reaches storage. */
function memoryBackend(): StorageBackend {
  const entries = new Map<string, string>();

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

/** The four persisted stores, each over its own fresh in-memory backend. */
function inMemoryStores(): CommandContext['stores'] {
  return {
    apps: createStore('apps', memoryBackend()),
    login: createStore('login', memoryBackend()),
    accounts: createAccountStore(createStore('accounts', memoryBackend())),
    settings: createStore('settings', memoryBackend()),
  };
}

/**
 * A complete CommandContext for tests: every callback a `vi.fn()` stub, `post`
 * resolving to no error, `state` a fresh initialAppState with its window list,
 * `now` the fixtures' date, and the stores in-memory. Each entry of
 * {@link overrides} replaces the field it names.
 */
export function fakeCommandContext(overrides: Partial<CommandContext> = {}): CommandContext {
  const state = initialAppState();

  return {
    print: vi.fn(),
    registry: EMPTY_REGISTRY,
    windows: state.windows,
    dispatchWindows: vi.fn(),
    clearActiveWindow: vi.fn(),
    state,
    dispatch: vi.fn(),
    now: vi.fn<CommandContext['now']>().mockReturnValue(FIXED_NOW),
    post: vi.fn<CommandContext['post']>().mockResolvedValue(null),
    setInput: vi.fn(),
    openComposer: vi.fn(),
    attachments: fakeAttachments(),
    navigate: vi.fn(),
    page: EXAMPLE_PAGE,
    config: EXAMPLE_CONFIG,
    stores: inMemoryStores(),
    ...overrides,
  };
}
