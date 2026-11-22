/**
 * Tests for the 429 handling of toApiResponse: the reset time read from
 * `X-RateLimit-Reset` (whole seconds as wired-be sends it, or a date as
 * Mastodon does) with `Retry-After` as the fallback, on hand-built Responses.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { toApiResponse } from './response';

const schema = v.object({ name: v.string() });

/** The result `toApiResponse` gives for a 429 carrying a reset time. */
function limitedAt(resetAt: Date | null): unknown {
  return { ok: false, error: { kind: 'rate-limited', resetAt } };
}

describe('toApiResponse on a 429', () => {
  it('maps a valid reset date header to the parsed date', async () => {
    const response = new Response(null, {
      status: 429,
      headers: { 'X-RateLimit-Reset': '2026-11-13T12:00:00.000Z' },
    });

    const result = await toApiResponse(response, schema);

    expect(result).toStrictEqual(limitedAt(new Date('2026-11-13T12:00:00.000Z')));
  });

  it('maps an unparseable reset header to a null date', async () => {
    const response = new Response(null, {
      status: 429,
      headers: { 'X-RateLimit-Reset': 'in a while' },
    });

    const result = await toApiResponse(response, schema);

    expect(result).toStrictEqual(limitedAt(null));
  });

  it('reads a numeric reset header as seconds from now', async () => {
    const response = new Response(null, { status: 429, headers: { 'x-ratelimit-reset': '6' } });

    const result = await toApiResponse(response, schema, () => 1_000_000);

    expect(result).toStrictEqual(limitedAt(new Date(1_006_000)));
  });

  it('falls back to numeric Retry-After seconds when the reset header is junk', async () => {
    const response = new Response(null, {
      status: 429,
      headers: { 'x-ratelimit-reset': 'soon', 'Retry-After': '30' },
    });

    const result = await toApiResponse(response, schema, () => 1_000_000);

    expect(result).toStrictEqual(limitedAt(new Date(1_030_000)));
  });

  it('falls back to an HTTP-date Retry-After when the reset header is junk', async () => {
    const response = new Response(null, {
      status: 429,
      headers: { 'x-ratelimit-reset': 'soon', 'Retry-After': 'Fri, 13 Nov 2026 12:00:00 GMT' },
    });

    const result = await toApiResponse(response, schema, () => 1_000_000);

    expect(result).toStrictEqual(limitedAt(new Date('2026-11-13T12:00:00.000Z')));
  });

  it('maps a junk reset and a junk Retry-After to a null date', async () => {
    const response = new Response(null, {
      status: 429,
      headers: { 'x-ratelimit-reset': 'soon', 'Retry-After': 'later' },
    });

    const result = await toApiResponse(response, schema);

    expect(result).toStrictEqual(limitedAt(null));
  });
});
