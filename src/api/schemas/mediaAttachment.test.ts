/**
 * Tests for the MediaAttachment schema: the required id, type and url, the
 * defaults the optional strings apply, the media kind normalization, empty alt
 * text, and the backend-only keys (`meta`, `pleroma`, `text_url`) that must
 * never reach the entity.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import type { MediaAttachment, MediaType } from './mediaAttachment';
import { MediaAttachmentSchema } from './mediaAttachment';

/** The attachment shape Mastodon's API reports for an image. */
const MASTODON_IMAGE = {
  id: '223',
  type: 'image',
  url: 'https://mastodon.example/media/aa/full.png',
  preview_url: 'https://mastodon.example/media/aa/small.png',
  remote_url: null,
  description: 'A cat asleep on a keyboard',
  blurhash: 'UBLf|6~q00^2.4Rj%MRQ',
  meta: { original: { width: 1280, height: 720, size: '1280x720', aspect: 1.78 } },
};

/** The kinds WiredFE renders: each one survives parsing unchanged. */
const KNOWN_KIND_CASES: readonly { readonly kind: MediaType }[] = [
  { kind: 'image' },
  { kind: 'gifv' },
  { kind: 'video' },
  { kind: 'audio' },
];

/** Kinds no renderer is chosen by: Pleroma's files, and made-up values. */
const UNKNOWN_KIND_CASES: readonly { readonly kind: string }[] = [
  { kind: 'document' },
  { kind: 'face' },
  { kind: 'holodeck' },
];

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): MediaAttachment {
  const result = v.safeParse(MediaAttachmentSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

describe('MediaAttachment schema', () => {
  it('passes a full Mastodon image through, dropping meta', () => {
    expect(parse(MASTODON_IMAGE)).toStrictEqual({
      id: '223',
      type: 'image',
      url: 'https://mastodon.example/media/aa/full.png',
      preview_url: 'https://mastodon.example/media/aa/small.png',
      remote_url: null,
      description: 'A cat asleep on a keyboard',
      blurhash: 'UBLf|6~q00^2.4Rj%MRQ',
    });
  });

  it('drops the pleroma block and turns empty alt text into null', () => {
    expect(
      parse({
        id: '9',
        type: 'image',
        url: 'https://pleroma.example/media/bb/photo.jpg',
        preview_url: 'https://pleroma.example/media/bb/thumb.jpg',
        remote_url: null,
        description: '',
        blurhash: null,
        pleroma: { mime_type: 'image/jpeg', sensitive: false },
      }),
    ).toStrictEqual({
      id: '9',
      type: 'image',
      url: 'https://pleroma.example/media/bb/photo.jpg',
      preview_url: 'https://pleroma.example/media/bb/thumb.jpg',
      remote_url: null,
      description: null,
      blurhash: null,
    });
  });

  it.each(UNKNOWN_KIND_CASES)('normalizes the $kind type to unknown', ({ kind }) => {
    expect(parse({ id: '12', type: kind, url: 'https://wired.example/media/12' }).type).toBe(
      'unknown',
    );
  });

  it('keeps the unknown kind Mastodon itself sends', () => {
    expect(parse({ id: '1', type: 'unknown', url: 'https://wired.example/media/1' }).type).toBe(
      'unknown',
    );
  });

  it.each(KNOWN_KIND_CASES)('passes a $kind attachment through unchanged', ({ kind }) => {
    expect(parse({ id: '1', type: kind, url: 'https://wired.example/media/1' }).type).toBe(kind);
  });

  it('applies null defaults to a minimal Wired attachment and drops text_url', () => {
    expect(
      parse({
        id: '5',
        type: 'video',
        url: 'https://wired.example/media/5.mp4',
        text_url: 'https://wired.example/media/5.txt',
      }),
    ).toStrictEqual({
      id: '5',
      type: 'video',
      url: 'https://wired.example/media/5.mp4',
      preview_url: null,
      remote_url: null,
      description: null,
      blurhash: null,
    });
  });

  it('keeps null and real values for every optional string', () => {
    expect(
      parse({
        id: '6',
        type: 'audio',
        url: 'https://wired.example/media/6.ogg',
        preview_url: null,
        remote_url: 'https://other.example/media/6.ogg',
        description: 'Field recording, rain',
        blurhash: 'EL%|~0Ix^-f3',
      }),
    ).toStrictEqual({
      id: '6',
      type: 'audio',
      url: 'https://wired.example/media/6.ogg',
      preview_url: null,
      remote_url: 'https://other.example/media/6.ogg',
      description: 'Field recording, rain',
      blurhash: 'EL%|~0Ix^-f3',
    });
  });

  it('fails when url is missing', () => {
    expect(v.safeParse(MediaAttachmentSchema, { id: '1', type: 'image' }).success).toBe(false);
  });

  it('fails when id is missing', () => {
    expect(v.safeParse(MediaAttachmentSchema, { type: 'image', url: '/m/1' }).success).toBe(false);
  });

  it('fails when type is missing', () => {
    expect(v.safeParse(MediaAttachmentSchema, { id: '1', url: '/m/1' }).success).toBe(false);
  });

  it('fails when type is not a string', () => {
    expect(v.safeParse(MediaAttachmentSchema, { id: '1', type: 0, url: '/m/1' }).success).toBe(
      false,
    );
  });

  it('fails when url is not a string', () => {
    expect(v.safeParse(MediaAttachmentSchema, { id: '1', type: 'image', url: 4 }).success).toBe(
      false,
    );
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(MediaAttachmentSchema, 'image').success).toBe(false);
  });
});
