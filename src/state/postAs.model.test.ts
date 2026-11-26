/**
 * Tests for the stored posting-account defaults (WFE-281): `postAs` on a feed
 * and on the settings reads back, old records without it still parse, a
 * feed's edit keeps it, setting and clearing it, `/set` does not list it, and
 * a synced snapshot carries it.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { decideSync, toSyncSnapshot } from './deskSync';
import {
  type FeedSpec,
  addAutoSources,
  addSource,
  removeSource,
  renameFeed,
  setFeedPostAs,
} from './feeds';
import { FeedsSchema } from './feedSchema';
import { SETTING_KEYS } from './settingKeys';
import { DEFAULT_SETTINGS, SettingsSchema } from './settings';
import { builtDesk } from '../test/deskFixtures';

const HOME = { accountKey: 'a#1', source: 'home' } as const;
const MAIN: FeedSpec = { id: 'f1', name: 'main', sources: [HOME] };
const WITH: FeedSpec = { ...MAIN, postAs: 'a#1' };

describe('the stored feed list with a posting account', () => {
  it('reads an old feed without one as having none, and a new one back unchanged', () => {
    expect(v.parse(FeedsSchema, [MAIN])).toStrictEqual([MAIN]);
    expect(v.parse(FeedsSchema, [WITH])).toStrictEqual([WITH]);
  });

  it('refuses a posting account that is not a string', () => {
    expect(v.safeParse(FeedsSchema, [{ ...MAIN, postAs: 3 }]).success).toBe(false);
  });
});

describe('the stored settings with a posting account', () => {
  it('defaults it to none and reads old settings without it as none', () => {
    expect(DEFAULT_SETTINGS.postAs).toBeNull();
    expect(v.parse(SettingsSchema, {}).postAs).toBeNull();
    expect(v.parse(SettingsSchema, { effects: true }).postAs).toBeNull();
  });

  it('reads a key and a null back, and refuses a number', () => {
    expect(v.parse(SettingsSchema, { postAs: 'a#1' }).postAs).toBe('a#1');
    expect(v.parse(SettingsSchema, { postAs: null }).postAs).toBeNull();
    expect(v.safeParse(SettingsSchema, { postAs: 1 }).success).toBe(false);
  });

  it('stays out of the /set knobs', () => {
    expect(SETTING_KEYS.map((meta) => meta.key)).not.toContain('postAs');
  });

  it('rides in a synced snapshot, feed defaults included', () => {
    const state = builtDesk();
    const settings = { ...state.settings, postAs: 'a#1', feeds: [WITH] };
    const remote: unknown = JSON.parse(JSON.stringify(toSyncSnapshot({ ...state, settings }, 5)));
    const decision = decideSync(0, remote);

    expect(decision.kind === 'apply' ? decision.snapshot.settings : null).toStrictEqual(settings);
  });
});

describe(setFeedPostAs, () => {
  it('sets the default of one feed and clears it again', () => {
    const other: FeedSpec = { id: 'f2', name: 'other', sources: [] };
    const set = setFeedPostAs([MAIN, other], 'f1', 'a#2');

    expect(set).toStrictEqual([{ ...MAIN, postAs: 'a#2' }, other]);
    expect(setFeedPostAs(set, 'f1', undefined)[0]?.postAs).toBeUndefined();
  });

  it('changes nothing for an unknown feed', () => {
    expect(setFeedPostAs([MAIN], 'f9', 'a#2')).toStrictEqual([MAIN]);
  });
});

describe('editing a feed that has a posting account', () => {
  it('keeps it through a rename, a source added and a source removed', () => {
    const renamed = renameFeed([WITH], 'f1', 'prime');

    expect(renamed.ok && renamed.value[0]?.postAs).toBe('a#1');
    expect(addSource([WITH], 'f1', [{ accountKey: 'a#2', source: 'home' }])[0]?.postAs).toBe('a#1');
    expect(removeSource([WITH], 'f1', HOME)[0]?.postAs).toBe('a#1');
  });

  it('still ends the automatic flag on an edit, and keeps it for the client’s own', () => {
    const auto: FeedSpec = { ...WITH, auto: true };

    expect(Object.hasOwn(removeSource([auto], 'f1', HOME)[0] ?? {}, 'auto')).toBe(false);
    expect(addAutoSources([auto], 'f1', [])[0]?.auto).toBe(true);
  });
});
