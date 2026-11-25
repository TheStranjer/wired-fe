/**
 * Tests for the v1 instance summary: Mastodon's `configuration` blocks,
 * Pleroma/Wired's top-level `max_toot_chars`, `poll_limits` and
 * `pleroma.metadata.features`, the fallthrough order between them, and the
 * degradation of malformed optional blocks to null without failing the
 * document.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { InstanceV1Schema } from './instanceV1';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): unknown {
  const result = v.safeParse(InstanceV1Schema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

const MASTODON_POLLS = {
  max_options: 4,
  max_characters_per_option: 30,
  min_expiration: 300,
  max_expiration: 2_592_000,
};

describe('InstanceV1 schema', () => {
  it('reads all limits from a Mastodon configuration block', () => {
    expect(
      parse({
        title: 'mastodon.example',
        version: '4.2.10',
        urls: { streaming: 'wss://mastodon.example' },
        configuration: {
          statuses: { max_characters: 500, max_media_attachments: 4 },
          polls: MASTODON_POLLS,
        },
      }),
    ).toStrictEqual({
      title: 'mastodon.example',
      version: '4.2.10',
      maxCharacters: 500,
      maxMediaAttachments: 4,
      pollLimits: {
        maxOptions: 4,
        maxCharactersPerOption: 30,
        minExpiration: 300,
        maxExpiration: 2_592_000,
      },
      features: [],
      postFormats: [],
    });
  });

  it('reads limits and features from a Pleroma or Wired document', () => {
    expect(
      parse({
        title: 'wired.example',
        version: '2.7.2 (compatible; Pleroma 2.5.0)',
        max_toot_chars: 1_000,
        poll_limits: {
          max_options: 6,
          max_option_chars: 40,
          min_expiration: 60,
          max_expiration: 86_400,
        },
        pleroma: {
          metadata: {
            features: ['reactions', 'oauth_api', 'shout'],
            post_formats: ['text/plain', 'text/markdown', 7],
          },
        },
      }),
    ).toStrictEqual({
      title: 'wired.example',
      version: '2.7.2 (compatible; Pleroma 2.5.0)',
      maxCharacters: 1_000,
      maxMediaAttachments: null,
      pollLimits: {
        maxOptions: 6,
        maxCharactersPerOption: 40,
        minExpiration: 60,
        maxExpiration: 86_400,
      },
      features: ['reactions', 'oauth_api', 'shout'],
      postFormats: ['text/plain', 'text/markdown'],
    });
  });

  it('prefers configuration over the Pleroma top level', () => {
    const output = parse({
      title: 'hybrid.example',
      version: '4.0.0',
      max_toot_chars: 1_000,
      configuration: { statuses: { max_characters: 300, max_media_attachments: 1 } },
    });

    expect(output).toMatchObject({ maxCharacters: 300, maxMediaAttachments: 1 });
  });

  it('falls through to max_toot_chars when configuration is malformed', () => {
    const output = parse({
      title: 'odd.example',
      version: '1.0',
      max_toot_chars: 800,
      configuration: { statuses: { max_characters: 'many' } },
    });

    expect(output).toMatchObject({ maxCharacters: 800, maxMediaAttachments: null });
  });

  it('keeps the rest of the document when configuration.polls is a string', () => {
    expect(
      parse({
        title: 'broken.example',
        version: '4.1.0',
        configuration: {
          statuses: { max_characters: 500, max_media_attachments: 2 },
          polls: 'four options, obviously',
        },
      }),
    ).toStrictEqual({
      title: 'broken.example',
      version: '4.1.0',
      maxCharacters: 500,
      maxMediaAttachments: 2,
      pollLimits: null,
      features: [],
      postFormats: [],
    });
  });

  it('nulls a partially present poll block', () => {
    const polls = { max_options: 4, max_characters_per_option: 30, min_expiration: 300 };
    const output = parse({ title: 'x.example', version: '1', configuration: { polls } });

    expect(output).toMatchObject({ pollLimits: null });
  });

  it('keeps only the strings of a mixed features list', () => {
    const output = parse({
      title: 'noisy.example',
      version: '1',
      pleroma: { metadata: { features: ['reactions', 7, null, 'oauth_api'] } },
    });

    expect(output).toMatchObject({ features: ['reactions', 'oauth_api'] });
  });

  it('ignores a pleroma metadata block that holds no list', () => {
    const output = parse({ title: 'quiet.example', version: '1', pleroma: { metadata: 'huh' } });

    expect(output).toMatchObject({ features: [] });
  });

  it('accepts a bare title and version with everything else unknown', () => {
    expect(parse({ title: 'minimal.example', version: '0.1' })).toStrictEqual({
      title: 'minimal.example',
      version: '0.1',
      maxCharacters: null,
      maxMediaAttachments: null,
      pollLimits: null,
      features: [],
      postFormats: [],
    });
  });

  it('fails when title or version is missing', () => {
    expect(v.safeParse(InstanceV1Schema, { version: '1' }).success).toBe(false);
    expect(v.safeParse(InstanceV1Schema, { title: 'x.example' }).success).toBe(false);
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(InstanceV1Schema, 'instance').success).toBe(false);
  });
});
