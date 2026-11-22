/**
 * Tests for the attachments half of postView: the media items in the row's
 * own field names, and a boost showing the original's attachments and
 * sensitive flag, never the boost wrapper's own.
 */

import { describe, expect, it } from 'vitest';

import { postView } from './postView';
import type { Viewer } from './postView';
import { status } from '../test/fixtures';

const SIGNED_OUT: Viewer = { origin: 'https://wired.example', accountId: null };

describe('postView media', () => {
  it('maps attachments onto media items under the row names', () => {
    const post = status('1', {
      sensitive: true,
      media_attachments: [
        {
          id: 'm1',
          type: 'image',
          url: 'https://wired.example/media/m1.png',
          preview_url: 'https://wired.example/media/m1.small.png',
          description: 'the fourth wall',
        },
        { id: 'm2', type: 'unknown', url: 'https://wired.example/media/m2.mkv' },
      ],
    });

    expect(postView(post, SIGNED_OUT).media).toStrictEqual([
      {
        id: 'm1',
        type: 'image',
        url: 'https://wired.example/media/m1.png',
        previewUrl: 'https://wired.example/media/m1.small.png',
        description: 'the fourth wall',
      },
      {
        id: 'm2',
        type: 'unknown',
        url: 'https://wired.example/media/m2.mkv',
        previewUrl: null,
        description: null,
      },
    ]);
    expect(postView(post, SIGNED_OUT).sensitive).toBe(true);
  });

  it('maps a non-http(s) attachment url to null', () => {
    const post = status('1', {
      media_attachments: [{ id: 'm1', type: 'unknown', url: 'intent://x' }],
    });

    expect(postView(post, SIGNED_OUT).media[0]?.url).toBeNull();
  });

  it('maps a non-http(s) preview url to null', () => {
    const post = status('1', {
      media_attachments: [
        {
          id: 'm1',
          type: 'image',
          url: 'https://wired.example/m1.png',
          preview_url: 'data:image/png;base64,AAAA',
        },
      ],
    });

    const item = postView(post, SIGNED_OUT).media[0];

    expect(item?.previewUrl).toBeNull();
    expect(item?.url).toBe('https://wired.example/m1.png');
  });

  it('shows the attachments and warning of the original, not the boost', () => {
    const boost = status('boost-1', {
      sensitive: true,
      media_attachments: [{ id: 'boost-m', type: 'image', url: 'https://wired.example/b.png' }],
      reblog: status('orig', {
        media_attachments: [{ id: 'orig-m', type: 'image', url: 'https://wired.example/o.png' }],
      }),
    });

    const view = postView(boost, SIGNED_OUT);

    expect(view.media.map((item) => item.id)).toStrictEqual(['orig-m']);
    expect(view.sensitive).toBe(false);
  });

  it('carries no media items or sensitivity for a plain post', () => {
    const view = postView(status('1'), SIGNED_OUT);

    expect(view.media).toStrictEqual([]);
    expect(view.sensitive).toBe(false);
  });
});
