/**
 * Tests for what `/vsplit` and `/split` refuse (decisions 12 and 13): a spec
 * that is not one echoes the usage, and a spec that cannot open — no such
 * window, no account, no command behind the view, a command that opens
 * nothing — says why; none of them splits the pane.
 */
import { describe, expect, it } from 'vitest';

import { command as split } from './defs/split';
import { command as vsplit } from './defs/vsplit';
import { OK, fail } from './outcome';
import { LAIN, desk, shown, stub } from '../test/splitDesk';
import { STATUS_WINDOW_ID } from '../windows/model';

describe('/vsplit and /split that cannot open', () => {
  it('echoes the usage for a view it does not know, splitting nothing', async () => {
    const session = desk([LAIN]);

    const outcome = await session.run(vsplit, 'frobnicate');

    expect(outcome).toStrictEqual(fail(`Unknown view: frobnicate. Usage: ${vsplit.usage}`));
    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID]);
  });

  it('names the stacked usage for /split', async () => {
    const outcome = await desk([LAIN]).run(split, 'tag');

    expect(outcome).toStrictEqual(fail(`tag needs an argument. Usage: ${split.usage}`));
  });

  it('refuses a window number past the list', async () => {
    const session = desk([LAIN]);

    await expect(session.run(vsplit, 'win 5')).resolves.toStrictEqual(fail('No window 5'));
    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID]);
  });

  it('says what the open command says when it refuses', async () => {
    const session = desk([]);

    const outcome = await session.run(split, 'tag rust');

    expect(outcome.ok).toBe(false);
    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID]);
  });

  it('says so when the backend lacks the command behind the view', async () => {
    const outcome = await desk([LAIN]).run(vsplit, 'search lain');

    expect(outcome).toStrictEqual(fail('/search is not available here'));
  });

  it('says so when the command opens nothing', async () => {
    const session = desk([LAIN], [stub('search', OK)]);

    await expect(session.run(vsplit, 'search lain')).resolves.toStrictEqual(
      fail('/search opened no window'),
    );
    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID]);
  });

  it('ignores window asks that are not an open', async () => {
    const wandering = stub('search', OK, (_args, dispatchWindows) => {
      dispatchWindows({ type: 'activate', id: STATUS_WINDOW_ID });
    });
    const session = desk([LAIN], [wandering]);

    await expect(session.run(vsplit, 'search lain')).resolves.toStrictEqual(
      fail('/search opened no window'),
    );
  });
});
