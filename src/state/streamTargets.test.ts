/**
 * Tests for routing a streaming frame by stream family: Mastodon/Pleroma's
 * public names (`user`, `['hashtag', 'rust']`) and wired-be's internal ones
 * (`user:<id>`, `hashtag:<tag>`, `hashtag:local:<tag>`) reach the same windows.
 */

import { describe, expect, it } from 'vitest';

import { streamFamilies, updateTargets } from './streamTargets';
import { status } from '../test/fixtures';
import { mentioning, MINE, ORIGIN } from '../test/streamWindows';
import type { WindowKind, WindowState } from '../windows/model';

const USER_ID = '0190aaaa-bbbb-cccc-dddd-eeeeffff0000';

function win(kind: WindowKind, target: string | null = null): WindowState {
  return {
    id: `${kind}:${target ?? ''}`,
    ref: { kind, accountKey: MINE, target },
    title: kind,
    unread: 0,
    highlight: false,
    display: {},
  };
}

const HOME = win('home');
const LOCAL = win('local');
const FEDERATED = win('federated');
const RUST = win('hashtag', 'rust');
const BOBS_DM = win('dm', 'bob@wired.example');
const ALL = [HOME, LOCAL, FEDERATED, RUST, BOBS_DM];

function reached(stream: readonly string[], extras: Record<string, unknown> = {}): string[] {
  const update = { status: status('s1', extras), stream, origin: ORIGIN };
  return updateTargets(ALL, MINE, update).map((target) => target.ref.kind);
}

describe(streamFamilies, () => {
  it('reads the account stream in both namings, but not its sub-streams', () => {
    expect(streamFamilies(['user']).user).toBe(true);
    expect(streamFamilies([`user:${USER_ID}`]).user).toBe(true);
    expect(streamFamilies([`user:notification:${USER_ID}`]).user).toBe(false);
    expect(streamFamilies([`user:pleroma_chat:${USER_ID}`]).user).toBe(false);
    expect(streamFamilies(['direct']).user).toBe(false);
  });

  it('takes public names exactly', () => {
    expect(streamFamilies(['public:local'])).toMatchObject({ publicLocal: true, public: false });
    expect(streamFamilies(['public'])).toMatchObject({ publicLocal: false, public: true });
    expect(streamFamilies(['public:media'])).toMatchObject({ publicLocal: false, public: false });
  });

  it('collects tags from the pair and from prefixed elements', () => {
    expect(streamFamilies(['hashtag', 'Rust']).tags).toStrictEqual(['Rust']);
    expect(streamFamilies(['hashtag:rust']).tags).toStrictEqual(['rust']);
    expect(streamFamilies(['hashtag:local:rust']).tags).toStrictEqual(['rust']);
  });

  it('finds no tag where none is named', () => {
    expect(streamFamilies(['hashtag']).tags).toStrictEqual([]);
    expect(streamFamilies(['hashtag:']).tags).toStrictEqual([]);
    expect(streamFamilies(['user']).tags).toStrictEqual([]);
  });
});

describe('updateTargets by stream family', () => {
  it('sends both user namings to the home window, and notifications nowhere', () => {
    expect(reached(['user'])).toStrictEqual(['home']);
    expect(reached([`user:${USER_ID}`])).toStrictEqual(['home']);
    expect(reached([`user:notification:${USER_ID}`])).toStrictEqual([]);
  });

  it('sends every hashtag naming to the tag window, and other tags nowhere', () => {
    expect(reached(['hashtag', 'Rust'])).toStrictEqual(['hashtag']);
    expect(reached(['hashtag:rust'])).toStrictEqual(['hashtag']);
    expect(reached(['hashtag:local:rust'])).toStrictEqual(['hashtag']);
    expect(reached(['hashtag:ruby'])).toStrictEqual([]);
  });

  it('sends a direct post on a wired-be user stream to the matching DM window', () => {
    const direct = { visibility: 'direct', mentions: [mentioning('bob@wired.example')] };

    expect(reached([`user:${USER_ID}`], direct)).toStrictEqual(['home', 'dm']);
    expect(reached(['user'], direct)).toStrictEqual(['home', 'dm']);
  });

  it('sends public:local to local but not federated', () => {
    expect(reached(['public:local'])).toStrictEqual(['local']);
    expect(reached(['public'])).toStrictEqual(['federated']);
  });
});
