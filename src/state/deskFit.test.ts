/**
 * Tests for the size guard of the synced desk (decision 17): a snapshot under
 * the budget goes unchanged; over it, hidden windows, then empty desktops,
 * then key overrides past 200 are left out, one stage at a time and only as
 * far as needed; a desk still too big is refused; bytes, not characters, are
 * what is counted.
 */
import { describe, expect, it } from 'vitest';

import { SYNC_BUDGET_BYTES, fitSnapshot, snapshotBytes } from './deskFit';
import { toSyncSnapshot } from './deskSync';
import type { SyncSnapshot } from './deskSync';
import { BOB_HOME_ID, builtDesk } from '../test/deskFixtures';
import { EMPTY_DESKTOP } from '../windows/desktopPanes';
import type { Desktop } from '../windows/desktopPanes';

const BASE = toSyncSnapshot(builtDesk(), 1);

/** A window no pane shows, with a title of {@link size} letters. */
function hidden(id: string, size: number): SyncSnapshot['windows'][number] {
  return {
    id,
    title: 'x'.repeat(size),
    ref: { kind: 'local', accountKey: null, target: null },
    display: {},
  };
}

/** {@link snapshot} with {@link n} key overrides. */
function withOverrides(snapshot: SyncSnapshot, n: number): SyncSnapshot {
  const keyOverrides = Array.from({ length: n }, (_, i) => ({
    mode: 'navigation' as const,
    chord: `Alt+${String(i)}`,
    line: null,
  }));
  return { ...snapshot, settings: { ...snapshot.settings, keyOverrides } };
}

/** {@link snapshot} on the desktops {@link desktops}, with {@link active} the active one. */
function onDesktops(
  snapshot: SyncSnapshot,
  desktops: SyncSnapshot['layout']['desktops'],
  active: number,
): SyncSnapshot {
  return { ...snapshot, layout: { ...snapshot.layout, desktops, active } };
}

/** The two desktops of the built desk. */
function builtDesktops(): { one: Desktop; two: Desktop } {
  const [one, two] = BASE.layout.desktops;
  if (one === undefined || two === undefined) {
    throw new Error('the built desk has two desktops');
  }
  return { one, two };
}

/** What {@link fitSnapshot} sends for {@link snapshot} at {@link budget}; fails the test on a refusal. */
function sent(snapshot: SyncSnapshot, budget: number) {
  const fit = fitSnapshot(snapshot, budget);
  if (!fit.ok) {
    return expect.fail(fit.reason);
  }
  return fit;
}

describe(fitSnapshot, () => {
  it('budgets 384 KiB per device class', () => {
    expect(SYNC_BUDGET_BYTES).toBe(393_216);
  });

  it('sends a snapshot under the budget unchanged', () => {
    const fit = sent(BASE, SYNC_BUDGET_BYTES);

    expect(fit.snapshot).toBe(BASE);
    expect(fit.dropped).toStrictEqual([]);
  });

  it('sends a snapshot exactly at the budget unchanged', () => {
    expect(sent(BASE, snapshotBytes(BASE)).dropped).toStrictEqual([]);
  });

  it('first leaves out the windows that no pane or float shows', () => {
    const big = { ...BASE, windows: [...BASE.windows, hidden('w1', 5000), hidden('w2', 5000)] };

    const fit = sent(big, snapshotBytes(BASE));

    expect(fit.snapshot.windows).toStrictEqual(BASE.windows);
    expect(fit.dropped).toStrictEqual(['2 hidden windows']);
  });

  it('keeps a window that only a float shows', () => {
    const big = { ...BASE, windows: [...BASE.windows, hidden('w1', 5000)] };

    const fit = sent(big, snapshotBytes(BASE));

    expect(fit.snapshot.windows.map((win) => win.id)).toContain(BOB_HOME_ID);
    expect(fit.dropped).toStrictEqual(['1 hidden window']);
  });

  it('then leaves out the empty desktops and follows the active one', () => {
    const { one, two } = builtDesktops();
    const big = onDesktops(BASE, [EMPTY_DESKTOP, one, EMPTY_DESKTOP, two], 3);

    const fit = sent(big, snapshotBytes(BASE));

    expect(fit.snapshot.layout.desktops).toStrictEqual([one, two]);
    expect(fit.snapshot.layout.active).toBe(1);
    expect(fit.dropped).toStrictEqual(['2 empty desktops']);
  });

  it('keeps the active desktop even when it is empty', () => {
    const { one, two } = builtDesktops();
    const big = onDesktops(BASE, [one, two, EMPTY_DESKTOP, EMPTY_DESKTOP], 3);

    const fit = sent(big, snapshotBytes(onDesktops(BASE, [one, two, EMPTY_DESKTOP], 2)));

    expect(fit.snapshot.layout.desktops).toStrictEqual([one, two, EMPTY_DESKTOP]);
    expect(fit.snapshot.layout.active).toBe(2);
    expect(fit.dropped).toStrictEqual(['1 empty desktop']);
  });

  it('then leaves out the key overrides past 200', () => {
    const fit = sent(withOverrides(BASE, 250), snapshotBytes(withOverrides(BASE, 200)));

    expect(fit.snapshot.settings.keyOverrides).toStrictEqual(
      withOverrides(BASE, 200).settings.keyOverrides,
    );
    expect(fit.dropped).toStrictEqual(['50 key overrides']);
  });

  it('keeps 200 key overrides when 201 are too many', () => {
    const fit = sent(withOverrides(BASE, 201), snapshotBytes(withOverrides(BASE, 200)));

    expect(fit.dropped).toStrictEqual(['1 key override']);
  });

  it('stops at the first stage that makes it fit', () => {
    const { one, two } = builtDesktops();
    const tidy = onDesktops(BASE, [one, two, EMPTY_DESKTOP], 0);
    const big = { ...tidy, windows: [...tidy.windows, hidden('w1', 5000)] };

    const fit = sent(big, snapshotBytes(tidy));

    expect(fit.dropped).toStrictEqual(['1 hidden window']);
    expect(fit.snapshot.layout.desktops).toHaveLength(3);
  });

  it('leaves out all three, in order, when each is needed', () => {
    const { one, two } = builtDesktops();
    const small = withOverrides(BASE, 200);
    const big = onDesktops(
      withOverrides({ ...BASE, windows: [...BASE.windows, hidden('w1', 100)] }, 250),
      [one, two, EMPTY_DESKTOP],
      0,
    );

    const fit = sent(big, snapshotBytes(small));

    expect(fit.dropped).toStrictEqual(['1 hidden window', '1 empty desktop', '50 key overrides']);
    expect(snapshotBytes(fit.snapshot)).toBe(snapshotBytes(small));
  });

  it('refuses a desk that is still too big once everything droppable is gone', () => {
    const heavy = {
      ...BASE,
      windows: BASE.windows.map((win, i) => (i === 0 ? { ...win, title: 'x'.repeat(5000) } : win)),
    };

    const fit = fitSnapshot(heavy, 2048);

    expect(fit.ok).toBe(false);
    expect(fit).toMatchObject({
      reason: expect.stringContaining(
        'Sync paused: the desk is too big to sync (over 2 KiB',
      ) as string,
    });
  });

  it('counts UTF-8 bytes, not characters', () => {
    const wide = {
      ...BASE,
      windows: BASE.windows.map((win, i) =>
        i === 0 ? { ...win, title: '日本語'.repeat(100) } : win,
      ),
    };
    const characters = JSON.stringify(wide).length;

    expect(snapshotBytes(wide)).toBe(characters + 2 * 300);
    expect(fitSnapshot(wide, characters).ok).toBe(false);
    expect(fitSnapshot(wide, snapshotBytes(wide)).ok).toBe(true);
  });
});
