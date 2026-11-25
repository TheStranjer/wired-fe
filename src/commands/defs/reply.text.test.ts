/**
 * Test that `/reply a0 <text>` still posts at once (WFE-244): text opens no
 * composer, not even text that ends the way a `--in` flag would.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './reply';
import type { StoredAccount } from '../../accounts/accountStore';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { type WindowRef, windowId } from '../../windows/model';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** The signed-in account whose home window shows the post. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
  refreshToken: null,
  expiresAt: null,
};

/** Lain's home window. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

/** Lain's session with her home window showing one post, labelled `a0`. */
function homeWithPost(): CommandContext {
  const signedIn = fakeCommandContext();
  const withAccount = appReducer(signedIn.state, {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const opened = appReducer(withAccount, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: windowId(HOME),
    statuses: [status('7')],
    where: 'newer',
  });
  return { ...signedIn, state: filled, windows: filled.windows };
}

describe('/reply with text', () => {
  it('posts at once, opening no composer, even for text that ends in --in <word>', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(status('reply'));
      }),
    );
    const context = homeWithPost();

    const outcome = await command.run('a0 look --in float', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ in_reply_to_id: '7' });
    expect(context.print).toHaveBeenCalledWith('↳ replied to [a0]');
    expect(context.dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'openPlaced' }),
    );
  });
});
