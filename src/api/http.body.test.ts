/**
 * Tests that `apiRequest` resolves, and never rejects, when the response
 * arrives but its body cannot be read.
 */
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from './http';
import { abortReason, failingBody } from '../test/failingBody';

const schema = v.object({ id: v.string() });

/** Make the next fetch answer with {@link response}. */
function answerWith(response: Response): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
}

/** One request to the stubbed fetch. */
async function request(): ReturnType<typeof apiRequest<{ id: string }>> {
  return await apiRequest({ origin: 'https://wired.example', path: '/api/v1/x', schema });
}

describe(apiRequest, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves to aborted when the signal aborts while the body is read', async () => {
    answerWith(failingBody(abortReason()));

    await expect(request()).resolves.toStrictEqual({ ok: false, error: { kind: 'aborted' } });
  });

  it('resolves to a network error when the connection drops mid-body', async () => {
    answerWith(failingBody(new TypeError('network error')));

    await expect(request()).resolves.toStrictEqual({
      ok: false,
      error: { kind: 'network', message: 'network error' },
    });
  });
});
