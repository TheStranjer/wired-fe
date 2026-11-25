/**
 * Tests for draftToNewStatus: the default visibility fills an unset one, an
 * explicit one wins, spoiler text survives only when non-empty, and every
 * other set field is copied through untouched.
 */
import { describe, expect, it } from 'vitest';

import { type Draft, draftToNewStatus, fieldsToDraft } from './draft';
import type { NewStatus } from '../api/endpoints/statusWrite';

/** A poll in the shape Draft keeps and NewStatus sends. */
const POLL: NonNullable<NewStatus['poll']> = {
  options: ['cats', 'dogs'],
  expiresIn: 3600,
  multiple: false,
};

/** A draft that sets every field the type offers. */
const FULL: Draft = {
  text: 'which companion?',
  spoilerText: 'pet poll',
  visibility: 'local',
  mediaIds: ['m1', 'm2'],
  poll: POLL,
  inReplyToId: 's7',
  quoteId: 's9',
};

describe(draftToNewStatus, () => {
  it('sends the text with the default visibility when the draft names none', () => {
    expect(draftToNewStatus({ text: 'hello' }, 'public')).toStrictEqual({
      status: 'hello',
      visibility: 'public',
    });
  });

  it('uses the draft visibility in place of the default', () => {
    expect(draftToNewStatus({ text: 'hi', visibility: 'direct' }, 'public')).toStrictEqual({
      status: 'hi',
      visibility: 'direct',
    });
  });

  it('copies a non-empty spoiler text', () => {
    expect(draftToNewStatus({ text: 'hi', spoilerText: 'spoilers' }, 'private')).toStrictEqual({
      status: 'hi',
      spoilerText: 'spoilers',
      visibility: 'private',
    });
  });

  it('drops an absent or empty spoiler text', () => {
    expect(draftToNewStatus({ text: 'hi' }, 'public')).not.toHaveProperty('spoilerText');
    expect(draftToNewStatus({ text: 'hi', spoilerText: '' }, 'public')).toStrictEqual({
      status: 'hi',
      visibility: 'public',
    });
  });

  it('copies media ids, the poll, the reply target and the quote', () => {
    expect(
      draftToNewStatus(
        { text: 'hi', mediaIds: ['m1'], poll: POLL, inReplyToId: 's1', quoteId: 's2' },
        'unlisted',
      ),
    ).toStrictEqual({
      status: 'hi',
      visibility: 'unlisted',
      mediaIds: ['m1'],
      poll: POLL,
      inReplyToId: 's1',
      quoteId: 's2',
    });
  });

  it('maps every field of a full draft and nothing else', () => {
    expect(draftToNewStatus(FULL, 'public')).toStrictEqual({
      status: 'which companion?',
      spoilerText: 'pet poll',
      visibility: 'local',
      mediaIds: ['m1', 'm2'],
      poll: POLL,
      inReplyToId: 's7',
      quoteId: 's9',
    });
  });
});

describe(fieldsToDraft, () => {
  it('carries the warning only when there is one', () => {
    expect(fieldsToDraft({ text: 'a', spoiler: '', visibility: 'public' })).toStrictEqual({
      text: 'a',
      visibility: 'public',
    });
    expect(fieldsToDraft({ text: 'a', spoiler: 'cw', visibility: 'direct' })).toStrictEqual({
      text: 'a',
      spoilerText: 'cw',
      visibility: 'direct',
    });
  });

  it('carries the poll with its options trimmed, and media only when there is some', () => {
    const poll = { options: [' cats ', 'dogs'], expiresIn: 3600, multiple: true, hideTotals: true };
    const fields = { text: 'a', spoiler: '', visibility: 'public' } as const;

    expect(fieldsToDraft({ ...fields, poll })).toStrictEqual({
      text: 'a',
      visibility: 'public',
      poll: { ...poll, options: ['cats', 'dogs'] },
    });
    expect(fieldsToDraft({ ...fields, mediaIds: ['m1'] })).toStrictEqual({
      text: 'a',
      visibility: 'public',
      mediaIds: ['m1'],
    });
    expect(fieldsToDraft({ ...fields, mediaIds: [] })).not.toHaveProperty('mediaIds');
  });
});
