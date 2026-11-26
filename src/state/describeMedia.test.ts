/**
 * Tests for describing a composer's attachments before a post: each ready
 * attachment the reader described gets its trimmed text put to the instance as
 * the account that owns it, the others cost no request, the first refusal comes
 * back as the message to show, and an account that is not signed in is refused.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { type AppState, initialAppState } from './appState';
import { describeMedia } from './describeMedia';
import type { ComposerMedia } from './draft';
import { appReducer } from './reducer';
import type { RefreshDeps } from './refreshSession';
import type { StoredAccount } from '../accounts/accountStore';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';

const ACCOUNT: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'secret',
  refreshToken: null,
  expiresAt: null,
};

/** A session signed in as {@link ACCOUNT}. */
function signedIn(): AppState {
  return appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
}

/** A ready line for attachment {@link mediaId}, described {@link description}. */
function line(
  mediaId: string,
  description: string,
  status: ComposerMedia['status'],
): ComposerMedia {
  return {
    key: `k${mediaId}`,
    name: `${mediaId}.png`,
    status,
    mediaId: status === 'ready' ? mediaId : null,
    previewUrl: null,
    description,
    error: '',
  };
}

/** The attachment a put answers with. */
function answer(id: string): Record<string, unknown> {
  return {
    id,
    type: 'image',
    url: `${ORIGIN}/media/${id}.png`,
    preview_url: null,
    remote_url: null,
    description: null,
    blurhash: null,
  };
}

/** Record every put into {@link puts} as `<id>: <description>`. */
function recordingPuts(puts: string[]): void {
  server.use(
    http.put(`${ORIGIN}/api/v1/media/:id`, async ({ params, request }) => {
      const body = (await request.json()) as { readonly description: string };
      puts.push(`${String(params['id'])}: ${body.description}`);

      return HttpResponse.json(answer(String(params['id'])));
    }),
  );
}

describe(describeMedia, () => {
  it('puts each described ready attachment’s trimmed text and skips the rest', async () => {
    const puts: string[] = [];
    recordingPuts(puts);
    const state = signedIn();

    const refused = await describeMedia({ state, dispatch: () => undefined }, ACCOUNT.key, [
      line('1', ' first ', 'ready'),
      line('2', '   ', 'ready'),
      line('3', 'still going up', 'uploading'),
      line('4', 'second', 'ready'),
    ]);

    expect(refused).toBeNull();
    expect(puts).toStrictEqual(['1: first', '4: second']);
  });

  it('skips an attachment whose text went up with the file and puts one edited since', async () => {
    const puts: string[] = [];
    recordingPuts(puts);

    const refused = await describeMedia(
      { state: signedIn(), dispatch: () => undefined },
      ACCOUNT.key,
      [
        { ...line('1', 'same', 'ready'), sent: ' same ' },
        { ...line('2', 'changed', 'ready'), sent: 'same' },
      ],
    );

    expect(refused).toBeNull();
    expect(puts).toStrictEqual(['2: changed']);
  });

  it('asks nothing of anyone when no attachment is described', async () => {
    const puts: string[] = [];
    recordingPuts(puts);

    const refused = await describeMedia({ state: signedIn(), dispatch: () => undefined }, null, [
      line('1', '', 'ready'),
    ]);

    expect(refused).toBeNull();
    expect(puts).toStrictEqual([]);
  });

  it('answers the first refusal and stops there', async () => {
    const puts: string[] = [];
    recordingPuts(puts);
    server.use(
      http.put(`${ORIGIN}/api/v1/media/1`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    const state = signedIn();
    const refresh: RefreshDeps = {
      refresher: null,
      dispatch: () => undefined,
      getState: () => state,
    };

    const refused = await describeMedia(
      { state, dispatch: () => undefined, refresh },
      ACCOUNT.key,
      [line('1', 'one', 'ready'), line('2', 'two', 'ready')],
    );

    expect(refused).toMatch(/HTTP 500/u);
    expect(puts).toStrictEqual([]);
  });

  it('says to log in when the account is not signed in', async () => {
    const refused = await describeMedia({ state: signedIn(), dispatch: () => undefined }, 'ghost', [
      line('1', 'one', 'ready'),
    ]);

    expect(refused).toBe('Not logged in. Type /connect');
  });
});
