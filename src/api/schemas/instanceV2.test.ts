/**
 * Tests for the v2 instance summary: limits read from configuration.statuses
 * and configuration.polls, api_versions.mastodon, the degradation of
 * malformed optional blocks to null, and the required title and version.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { NO_ANONYMOUS_READS } from './anonymousReads';
import { InstanceV2Schema } from './instanceV2';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): unknown {
  const result = v.safeParse(InstanceV2Schema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

const FULL_V2 = {
  title: 'mastodon.example',
  version: '4.3.0',
  api_versions: { mastodon: 2 },
  configuration: {
    statuses: { max_characters: 500, max_media_attachments: 4 },
    polls: {
      max_options: 4,
      max_characters_per_option: 30,
      min_expiration: 300,
      max_expiration: 2_592_000,
    },
  },
  contact: { email: 'admin@mastodon.example' },
};

describe('InstanceV2 schema', () => {
  it('reads every limit and the API version from a Mastodon document', () => {
    expect(parse(FULL_V2)).toStrictEqual({
      title: 'mastodon.example',
      version: '4.3.0',
      mastodonApiVersion: 2,
      maxCharacters: 500,
      maxMediaAttachments: 4,
      pollLimits: {
        maxOptions: 4,
        maxCharactersPerOption: 30,
        minExpiration: 300,
        maxExpiration: 2_592_000,
      },
      anonymousReads: NO_ANONYMOUS_READS,
    });
  });

  it('reads api_versions.mastodon six', () => {
    const output = parse({ ...FULL_V2, api_versions: { mastodon: 6 } });

    expect(output).toMatchObject({ mastodonApiVersion: 6 });
  });

  it('nulls the API version when api_versions is absent', () => {
    const output = parse({ title: 'old.example', version: '3.1.0', configuration: {} });

    expect(output).toMatchObject({ mastodonApiVersion: null });
  });

  it('nulls a non-integer API version', () => {
    const output = parse({ ...FULL_V2, api_versions: { mastodon: 'two' } });

    expect(output).toMatchObject({ mastodonApiVersion: null });
  });

  it('keeps the rest of the document when configuration.polls is malformed', () => {
    const output = parse({
      title: 'broken.example',
      version: '4.2.0',
      api_versions: { mastodon: 1 },
      configuration: { statuses: { max_characters: 500 }, polls: { max_options: 'four' } },
    });

    expect(output).toStrictEqual({
      title: 'broken.example',
      version: '4.2.0',
      mastodonApiVersion: 1,
      maxCharacters: 500,
      maxMediaAttachments: null,
      pollLimits: null,
      anonymousReads: NO_ANONYMOUS_READS,
    });
  });

  it('accepts a bare title and version', () => {
    expect(parse({ title: 'minimal.example', version: '0.1' })).toStrictEqual({
      title: 'minimal.example',
      version: '0.1',
      mastodonApiVersion: null,
      maxCharacters: null,
      maxMediaAttachments: null,
      pollLimits: null,
      anonymousReads: NO_ANONYMOUS_READS,
    });
  });

  it('has no Pleroma top-level fallback', () => {
    const output = parse({ title: 'pleroma.example', version: '1', max_toot_chars: 1_000 });

    expect(output).toMatchObject({ maxCharacters: null });
  });

  it('fails when title or version is missing', () => {
    expect(v.safeParse(InstanceV2Schema, { version: '1' }).success).toBe(false);
    expect(v.safeParse(InstanceV2Schema, { title: 'x.example' }).success).toBe(false);
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(InstanceV2Schema, 42).success).toBe(false);
  });
});
