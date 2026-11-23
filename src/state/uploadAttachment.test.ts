// @vitest-environment node
/**
 * Tests for the state layer's upload seam (WFE-126): the file keeps its own
 * name on the wire, the alt description rides with it when one is given and is
 * left off when the picker asked for none, an unsigned-in session answers
 * without a request, and a refused upload comes back already worded. Runs in
 * the node environment so the multipart body is the native one the MSW handler
 * can parse, the way src/api's own media tests do.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { initialAppState } from './appState';
import { type AppAction, appReducer } from './reducer';
import { uploadAttachment } from './uploadAttachment';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';

const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'not-a-real-token',
  refreshToken: null,
  expiresAt: null,
};

/** The signed-in, detected session the uploads run through. */
const SIGNED_IN: readonly AppAction[] = [
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
];

/** A fresh session moved along by {@link actions}. */
function stateAfter(actions: readonly AppAction[]) {
  return actions.reduce(appReducer, initialAppState());
}

/** The attachment the fake instance answers uploads with. */
const READY = {
  id: '12',
  type: 'image',
  url: `${ORIGIN}/media/12.png`,
  preview_url: null,
  remote_url: null,
  description: null,
  blurhash: null,
};

/** One image file named after {@link name}. */
function picture(name: string): File {
  return new File(['pixel'], name, { type: 'image/png' });
}

/** The file part of a parsed multipart body, throwing when absent. */
function filePartOf(form: FormData): File {
  const entry = form.get('file');

  if (typeof entry !== 'object' || entry === null) {
    throw new Error('expected the upload to carry a file part');
  }

  return entry;
}

describe(uploadAttachment, () => {
  it('uploads the file under its own name and the given description', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, async ({ request }) => {
        const form = await request.formData();

        expect(form.get('description')).toBe('a wall at night');
        expect(filePartOf(form).name).toBe('pixel.png');

        return HttpResponse.json(READY);
      }),
    );

    const outcome = await uploadAttachment({
      state: stateAfter(SIGNED_IN),
      accountKey: ACCOUNT.key,
      file: picture('pixel.png'),
      description: 'a wall at night',
    });

    expect(outcome).toStrictEqual({ ok: true, value: READY });
  });

  it('sends no description when the picker asked for none', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, async ({ request }) => {
        const form = await request.formData();

        expect(form.get('description')).toBeNull();

        return HttpResponse.json(READY);
      }),
    );

    const outcome = await uploadAttachment({
      state: stateAfter(SIGNED_IN),
      accountKey: ACCOUNT.key,
      file: picture('pixel.png'),
      description: '',
    });

    expect(outcome.ok).toBe(true);
  });

  it('says who is missing when the account key names no session', async () => {
    const outcome = await uploadAttachment({
      state: stateAfter([]),
      accountKey: null,
      file: picture('pixel.png'),
      description: '',
    });

    expect(outcome).toStrictEqual({ ok: false, error: 'Not logged in. Type /connect' });
  });

  it('words a refused upload as the line to print', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, () => {
        return HttpResponse.json({ error: 'Too big' }, { status: 422 });
      }),
    );

    const outcome = await uploadAttachment({
      state: stateAfter(SIGNED_IN),
      accountKey: ACCOUNT.key,
      file: picture('pixel.png'),
      description: '',
    });

    expect(outcome).toStrictEqual({ ok: false, error: 'HTTP 422: Too big' });
  });
});
