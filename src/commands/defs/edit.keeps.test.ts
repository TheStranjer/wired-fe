/**
 * Tests for what /edit re-sends besides the new text, over the shared MSW
 * server: Mastodon drops media, sensitivity and the poll that an edit leaves
 * out, so the PUT carries the post's own media ids, `sensitive`, language and
 * poll. The poll goes with its options and `multiple` and the seconds it has
 * left on the context's clock (never under the instance's minimum); a poll
 * that has closed is refused before any request.
 */
import { describe, expect, it } from 'vitest';

import { command } from './edit';
import { DEFAULT_POLL_LIMITS } from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { ORIGIN, homeContext, putStatus } from '../../test/editHome';
import { status, TEST_DATE } from '../../test/fixtures';
import type { CommandOutcome } from '../types';

/** The instance that takes edits (decision 5). */
const EDITING_PROFILE: InstanceProfile = {
  origin: ORIGIN,
  title: 'Wired',
  capabilities: {
    backend: 'wired',
    maxCharacters: 5000,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set(['editing']),
  },
};

/** The status as the instance answers the PUT. */
const EDITED = status('p', { spoiler_text: 'warning', content: '<p>new text</p>' });

/** The wire attachment with id {@link id}. */
function attachment(id: string): Record<string, unknown> {
  return { id, type: 'image', url: `https://wired.example/${id}.png` };
}

/** A poll closing {@link seconds} after the context's clock, `expired` as given. */
function poll(seconds: number | null, expired = false): Record<string, unknown> {
  return {
    id: 'poll1',
    expires_at:
      seconds === null
        ? null
        : new Date(new Date(TEST_DATE).getTime() + seconds * 1000).toISOString(),
    expired,
    multiple: true,
    votes_count: 3,
    options: [
      { title: 'yes', votes_count: 2 },
      { title: 'no', votes_count: 1 },
    ],
  };
}

/** Run `/edit` on a post with {@link extras}, the PUT expecting {@link kept} besides the text. */
async function editKeeping(
  extras: Record<string, unknown>,
  kept: Record<string, unknown>,
): Promise<CommandOutcome> {
  putStatus('new text', EDITED, kept);
  const post = status('p', { spoiler_text: 'warning', ...extras });

  return await command.run('a0 new text', homeContext(EDITING_PROFILE, [post]));
}

/** The poll the posts here carry, as the PUT states it with {@link expiresIn}. */
function keptPoll(expiresIn: number): Record<string, unknown> {
  return {
    sensitive: false,
    media_ids: [],
    poll: { options: ['yes', 'no'], expires_in: expiresIn, multiple: true },
  };
}

describe('/edit keeping the rest of the post', () => {
  it('sends the media ids, sensitivity and language the post has', async () => {
    const outcome = await editKeeping(
      {
        sensitive: true,
        language: 'ja',
        media_attachments: [attachment('a'), attachment('b')],
      },
      { sensitive: true, media_ids: ['a', 'b'], language: 'ja' },
    );

    expect(outcome).toStrictEqual({ ok: true });
  });

  it('sends the poll options and multiple with the seconds left', async () => {
    const outcome = await editKeeping({ poll: poll(1200) }, keptPoll(1200));

    expect(outcome).toStrictEqual({ ok: true });
  });

  it('sends at least the minimum poll expiration when it closes sooner', async () => {
    const outcome = await editKeeping(
      { poll: poll(30) },
      keptPoll(DEFAULT_POLL_LIMITS.minExpiration),
    );

    expect(outcome).toStrictEqual({ ok: true });
  });

  it('sends the longest expiration for a poll that never closes', async () => {
    const outcome = await editKeeping(
      { poll: poll(null) },
      keptPoll(DEFAULT_POLL_LIMITS.maxExpiration),
    );

    expect(outcome).toStrictEqual({ ok: true });
  });

  it.each([
    ['flagged expired', poll(1200, true)],
    ['past its expires_at', poll(-900)],
  ])('refuses a post whose poll is %s without a request', async (_name, closed) => {
    const context = homeContext(EDITING_PROFILE, [status('p', { poll: closed })]);

    const outcome = await command.run('a0 new text', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "Can't edit a post whose poll has closed",
    });
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});
