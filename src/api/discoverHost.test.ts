/**
 * Tests for API host discovery (WFE-343): the origin of the first NodeInfo
 * link, and null for everything that cannot name another usable origin.
 */
import { HttpResponse, type JsonBodyType, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { discoverApiOrigin } from './discoverHost';
import { server } from '../test/server';

const HANDLE = 'https://hyper.example';
const API = 'https://fedi.hyper.example';

/** Answers the handle domain's nodeinfo discovery with {@link body}. */
function answer(body: JsonBodyType): void {
  server.use(http.get(`${HANDLE}/.well-known/nodeinfo`, () => HttpResponse.json(body)));
}

describe(discoverApiOrigin, () => {
  it('names the origin of the first link', async () => {
    answer({
      links: [
        { rel: 'a', href: `${API}/nodeinfo/2.1` },
        { rel: 'b', href: 'https://third.example/nodeinfo' },
      ],
    });

    await expect(discoverApiOrigin(HANDLE)).resolves.toBe(API);
  });

  it('follows the redirect the handle domain answers with', async () => {
    server.use(
      http.get(`${HANDLE}/.well-known/nodeinfo`, () =>
        HttpResponse.redirect(`${API}/.well-known/nodeinfo`, 301),
      ),
      http.get(`${API}/.well-known/nodeinfo`, () =>
        HttpResponse.json({ links: [{ rel: 'a', href: `${API}/nodeinfo/2.1` }] }),
      ),
    );

    await expect(discoverApiOrigin(HANDLE)).resolves.toBe(API);
  });

  it('is null when the link is on the same origin', async () => {
    answer({ links: [{ rel: 'a', href: `${HANDLE}/nodeinfo/2.1` }] });

    await expect(discoverApiOrigin(HANDLE)).resolves.toBeNull();
  });

  it('is null without links', async () => {
    answer({ links: [] });

    await expect(discoverApiOrigin(HANDLE)).resolves.toBeNull();
  });

  it('is null when the links are not the expected shape', async () => {
    answer({ links: 'none' });

    await expect(discoverApiOrigin(HANDLE)).resolves.toBeNull();
  });

  it('is null when the href is not a URL', async () => {
    answer({ links: [{ rel: 'a', href: '/nodeinfo/2.1' }] });

    await expect(discoverApiOrigin(HANDLE)).resolves.toBeNull();
  });

  it('is null when the href is not an allowed instance URL', async () => {
    answer({ links: [{ rel: 'a', href: 'http://fedi.hyper.example/nodeinfo/2.1' }] });

    await expect(discoverApiOrigin(HANDLE)).resolves.toBeNull();
  });

  it('is null when the request fails', async () => {
    server.use(http.get(`${HANDLE}/.well-known/nodeinfo`, () => HttpResponse.error()));

    await expect(discoverApiOrigin(HANDLE)).resolves.toBeNull();
  });

  it('is null when the body is not JSON', async () => {
    server.use(http.get(`${HANDLE}/.well-known/nodeinfo`, () => HttpResponse.text('nope')));

    await expect(discoverApiOrigin(HANDLE)).resolves.toBeNull();
  });
});
