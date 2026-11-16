/**
 * Tests for /thread: a post label and the navigation selection open that
 * post's thread window, owned by the acting account, targeted at the status
 * id and titled `thread/<label>` after the line the active window shows; a
 * boost opens its original under the booster's label. Nothing selected and no
 * label says to select first, an unknown label names itself, and nobody
 * signed in is refused before any window is asked for. The definition also
 * declares the grammar and the navigation `t` binding the keymap generates.
 */
import { describe, expect, it } from 'vitest';

import { command } from './thread';
import { accountKey } from '../../accounts/accountStore';
import { fakeCommandContext } from '../../test/commandContext';
import { TEST_DATE, status } from '../../test/fixtures';
import { homeContext, ORIGIN } from '../../test/homeWindow';

const LAIN_KEY = accountKey(ORIGIN, '1');

/** Somebody else's account, so the target's author is not lain's. */
const NINE_WIRE = {
  id: '9',
  username: 'nine',
  acct: 'nine@pleroma.example',
  display_name: 'Nine',
  created_at: TEST_DATE,
  note: '',
  url: 'https://pleroma.example/@nine',
  avatar: 'https://pleroma.example/avi.png',
  header: 'https://pleroma.example/banner.png',
  followers_count: 3,
  following_count: 4,
  statuses_count: 5,
};

/** A post by nine; the label the home window gives it, and its window title. */
const BY_NINE = status('n', { account: NINE_WIRE });
const OPEN_NINE = {
  type: 'open' as const,
  ref: { kind: 'thread' as const, accountKey: LAIN_KEY, target: 'n' },
  title: 'thread/a0',
};

describe('/thread', () => {
  it('opens the window of the post a label names', async () => {
    const context = homeContext([BY_NINE]);

    await expect(command.run('a0', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatchWindows).toHaveBeenCalledWith(OPEN_NINE);
  });

  it('opens the window of the selected post', async () => {
    const context = homeContext([BY_NINE], 'n');

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatchWindows).toHaveBeenCalledWith(OPEN_NINE);
  });

  it('opens the boosted original of a boost, titled after its line', async () => {
    const boost = status('b1', { reblog: BY_NINE });
    const context = homeContext([boost], 'b1');

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatchWindows).toHaveBeenCalledWith(OPEN_NINE);
  });

  it('refuses with nothing selected and asks for no window', async () => {
    const context = homeContext([BY_NINE]);

    await expect(command.run('', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Select a post first (j/k) or give a label',
    });

    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses a label this window never gave and asks for no window', async () => {
    const context = homeContext([BY_NINE]);

    await expect(command.run('a7', context)).resolves.toStrictEqual({
      ok: false,
      message: 'No post a7 here',
    });

    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses while nobody is signed in', async () => {
    const context = fakeCommandContext();

    await expect(command.run('a0', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Not logged in. Type /connect',
    });

    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('is /thread, bound to navigation t', () => {
    expect(command.name).toBe('thread');
    expect(command.aliases).toStrictEqual([]);
    expect(command.usage).toBe('/thread [label]');
    expect(command.summary).toBe("Open a post's thread window");
    expect(command.bindings).toStrictEqual([{ mode: 'navigation', chord: 't', args: '' }]);
  });
});
