/**
 * Tests for the cases where /pop opens nothing (WFE-291): inside a thread
 * window, tiled or floating, the post is already in the thread and an info line
 * says so; a thread already shown in a pane or float of the desktop is focused,
 * a float raised, instead of shown twice; and `/float thread` still places
 * explicitly.
 */
import { describe, expect, it } from 'vitest';

import { command as float } from './float';
import { command } from './pop';
import { command as thread } from './thread';
import {
  HOME_ID,
  THREAD_A,
  fillThread,
  focusHomeBeside,
  popSession,
  shownIds,
} from '../../test/popSession';
import { shownPanes } from '../../windows/desktopPanes';
import { activeDesktop } from '../../windows/desktops';
import { STATUS_WINDOW_ID, activeWindow } from '../../windows/model';

/** A session over the home window showing post `a`. */
function session(): ReturnType<typeof popSession> {
  return popSession([float, thread], null);
}

/** The one line a pop inside a thread prints. */
const IN_THREAD = 'Already in this thread';

describe('/pop inside a thread window', () => {
  it.each(['a0', 'a1'])(
    'opens nothing and prints that it is already in the thread for %s in a floating thread',
    async (label) => {
      const run = session();
      await command.run('a0', run.context());
      fillThread(run);
      const before = run.state().layout;

      await expect(command.run(label, run.context())).resolves.toStrictEqual({ ok: true });

      expect(activeWindow(run.state().windows).id).toBe(THREAD_A);
      expect(run.state().layout).toBe(before);
      expect(run.print).toHaveBeenCalledExactlyOnceWith(IN_THREAD);
    },
  );

  it.each(['a0', 'a1'])(
    'opens nothing and prints that it is already in the thread for %s in a tiled thread',
    async (label) => {
      const run = session();
      await thread.run('a0', run.context());
      fillThread(run);
      const before = run.state().layout;

      await expect(command.run(label, run.context())).resolves.toStrictEqual({ ok: true });

      expect(activeWindow(run.state().windows).id).toBe(THREAD_A);
      expect(run.state().layout).toBe(before);
      expect(run.print).toHaveBeenCalledExactlyOnceWith(IN_THREAD);
    },
  );

  it('stands on the selected post when no label is given', async () => {
    const run = session();
    await command.run('a0', run.context());
    fillThread(run);
    run.dispatch({ type: 'select', windowId: THREAD_A, key: 'post:a' });

    await expect(command.run('', run.context())).resolves.toStrictEqual({ ok: true });

    expect(run.print).toHaveBeenCalledExactlyOnceWith(IN_THREAD);
  });

  it('refuses a label the thread window never gave, printing nothing', async () => {
    const run = session();
    await command.run('a0', run.context());
    fillThread(run);

    await expect(command.run('a9', run.context())).resolves.toStrictEqual({
      ok: false,
      message: 'No post a9 here',
    });
    expect(run.print).not.toHaveBeenCalled();
  });
});

describe('/pop of a thread already shown', () => {
  it('focuses the tiled pane that shows the thread, adding none', async () => {
    const run = session();
    await thread.run('a0', run.context());
    focusHomeBeside(run);
    const before = shownIds(run.state());

    await expect(command.run('a0', run.context())).resolves.toStrictEqual({ ok: true });

    expect(before).toStrictEqual([THREAD_A, HOME_ID]);
    expect(shownIds(run.state())).toStrictEqual(before);
    expect(activeDesktop(run.state().layout).focusedPaneId).toBe(
      shownPanes(activeDesktop(run.state().layout))[0]?.paneId,
    );
    expect(activeWindow(run.state().windows).id).toBe(THREAD_A);
  });

  it('focuses and raises the float that shows the thread, adding none', async () => {
    const run = session();
    await command.run('a0', run.context());
    await float.run('win 1', run.context());
    const home = shownPanes(activeDesktop(run.state().layout))[0];
    run.dispatch({ type: 'layout', action: { type: 'focusPane', paneId: home?.paneId ?? '' } });
    const before = activeDesktop(run.state().layout).floats.map((item) => item.windowId);

    await expect(command.run('a0', run.context())).resolves.toStrictEqual({ ok: true });

    const { floats, focusedPaneId } = activeDesktop(run.state().layout);

    expect(before).toStrictEqual([THREAD_A, STATUS_WINDOW_ID]);
    expect(floats.map((item) => item.windowId)).toStrictEqual([STATUS_WINDOW_ID, THREAD_A]);
    expect(focusedPaneId).toBe(floats[1]?.paneId);
    expect(activeWindow(run.state().windows).id).toBe(THREAD_A);
  });

  it('leaves /float thread alone: it still opens a second float beside the first', async () => {
    const run = session();
    await command.run('a0', run.context());
    focusHomeBeside(run);

    await float.run('thread a0', run.context());

    expect(shownIds(run.state()).filter((id) => id === THREAD_A)).toHaveLength(2);
  });
});
