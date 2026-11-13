// @vitest-environment node
/**
 * Media endpoints over the shared MSW server: the multipart upload, its 202
 * answer whose null url reads as empty, reading an attachment by id, and
 * uploadAndWait — at once, on the second poll, a failing poll as is, and the
 * maxPolls timeout. Waits are injected or faked; none sleeps on real time.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { getMedia, uploadMedia, uploadAndWait } from './media';
import { type Result, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import type { MediaAttachment } from '../schemas/mediaAttachment';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

const BLOB = new Blob(['pixel']);

/** The processed attachment the server reports once the file is ready. */
const READY: MediaAttachment = {
  id: '12',
  type: 'image',
  url: 'https://wired.example/media/12.png',
  preview_url: 'https://wired.example/media/12.thumb.png',
  remote_url: null,
  description: 'A pixel',
  blurhash: null,
};

/** READY's wire shape with a different url (null while still processing). */
function wireAttachment(url: string | null) {
  return { ...READY, url };
}

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }

  return result.error;
}

/** The file part of a parsed multipart body, throwing when absent. */
function filePartOf(form: FormData): File {
  const entry: FormDataEntryValue | null = form.get('file');
  if (typeof entry !== 'object' || entry === null) {
    throw new Error('expected the upload to carry a file part');
  }

  return entry;
}

/** An injected wait recording the intervals it was asked to sleep. */
function waiting() {
  const waits: number[] = [];

  return {
    waits,
    wait: async (ms: number): Promise<void> => {
      waits.push(ms);

      await Promise.resolve();
    },
  };
}

describe(uploadMedia, () => {
  it('posts the file as form data and returns the attachment', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, async ({ request }) => {
        expect(request.headers.get('Content-Type')).toMatch(/^multipart\/form-data/u);

        const form = await request.formData();

        expect(form.get('description')).toBeNull();

        const file = filePartOf(form);

        expect(file.name).toBe('blob');

        await expect(file.text()).resolves.toBe('pixel');

        return HttpResponse.json(READY);
      }),
    );

    const result = await uploadMedia(SESSION, BLOB, {});

    expect(result).toStrictEqual(ok(READY));
  });

  it('sends the filename and description, reading a 202 null url as empty', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, async ({ request }) => {
        const form = await request.formData();

        expect(form.get('description')).toBe('A pixel');

        expect(filePartOf(form).name).toBe('pixel.png');

        return HttpResponse.json(wireAttachment(null), { status: 202 });
      }),
    );

    const result = await uploadMedia(SESSION, BLOB, {
      filename: 'pixel.png',
      description: 'A pixel',
    });

    expect(result).toStrictEqual(ok({ ...READY, url: '' }));
  });

  it('reports a rejected upload as its http error', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, () => {
        return HttpResponse.json({ error: 'File exceeds size limit' }, { status: 422 });
      }),
    );

    const result = await uploadMedia(SESSION, BLOB, {});

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 422,
      message: 'File exceeds size limit',
    });
  });
});

describe(getMedia, () => {
  it('reads one attachment by id', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/media/12`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer secret');

        return HttpResponse.json(READY);
      }),
    );

    const result = await getMedia(SESSION, '12');

    expect(result).toStrictEqual(ok(READY));
  });

  it('keeps an id with a slash inside one encoded path segment', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/media/:id`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/media/a%2Fb');

        return HttpResponse.json(READY);
      }),
    );

    const result = await getMedia(SESSION, 'a/b');

    expect(result).toStrictEqual(ok(READY));
  });
});

describe(uploadAndWait, () => {
  it('returns an upload the server already finished, without polling', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, () => {
        return HttpResponse.json(READY);
      }),
    );

    const { waits, wait } = waiting();

    const result = await uploadAndWait(SESSION, BLOB, { wait });

    expect(result).toStrictEqual(ok(READY));

    expect(waits).toStrictEqual([]);
  });

  it('returns the attachment the second poll makes ready', async () => {
    let polls = 0;
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, () => {
        return HttpResponse.json(wireAttachment(null), { status: 202 });
      }),
      http.get(`${ORIGIN}/api/v1/media/12`, () => {
        polls += 1;

        if (polls === 1) {
          return HttpResponse.json(wireAttachment(null), { status: 206 });
        }

        return HttpResponse.json(READY);
      }),
    );

    const { waits, wait } = waiting();

    const result = await uploadAndWait(SESSION, BLOB, { wait });

    expect(result).toStrictEqual(ok(READY));

    expect(waits).toStrictEqual([1_000, 1_000]);
  });

  it('returns the error of a failing poll', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, () => {
        return HttpResponse.json(wireAttachment(null), { status: 202 });
      }),
      http.get(`${ORIGIN}/api/v1/media/12`, () => {
        return HttpResponse.json({ error: 'unknown media' }, { status: 404 });
      }),
    );

    const { waits, wait } = waiting();

    const result = await uploadAndWait(SESSION, BLOB, { wait });

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 404,
      message: 'unknown media',
    });

    expect(waits).toStrictEqual([1_000]);
  });

  it('times out after maxPolls waits on intervalMs', async () => {
    let polls = 0;
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, () => {
        return HttpResponse.json(wireAttachment(null), { status: 202 });
      }),
      http.get(`${ORIGIN}/api/v1/media/12`, () => {
        polls += 1;

        return HttpResponse.json(wireAttachment(null), { status: 202 });
      }),
    );

    const { waits, wait } = waiting();

    const result = await uploadAndWait(SESSION, BLOB, { wait, maxPolls: 3, intervalMs: 10 });

    expect(failureOf(result)).toStrictEqual({
      kind: 'parse',
      message: 'Media processing timed out',
    });

    expect(polls).toBe(3);

    expect(waits).toStrictEqual([10, 10, 10]);
  });

  it('sleeps on the default interval when no wait is given', async () => {
    vi.useFakeTimers();

    try {
      let polls = 0;
      server.use(
        http.post(`${ORIGIN}/api/v2/media`, () => {
          return HttpResponse.json(wireAttachment(null), { status: 202 });
        }),
        http.get(`${ORIGIN}/api/v1/media/12`, () => {
          polls += 1;

          if (polls === 1) {
            return HttpResponse.json(wireAttachment(null), { status: 202 });
          }

          return HttpResponse.json(READY);
        }),
      );

      const pending = uploadAndWait(SESSION, BLOB, {});

      await vi.runAllTimersAsync();

      await expect(pending).resolves.toStrictEqual(ok(READY));
    } finally {
      vi.useRealTimers();
    }
  });
});
