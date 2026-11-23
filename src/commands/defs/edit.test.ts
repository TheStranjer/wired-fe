/**
 * Tests for /edit with text on the line, over the shared MSW server: the new
 * body leaves as a PUT of the status path with the post's own content warning
 * riding along, and the answered status replaces the post in every scrollback
 * while the window prints `✎ edited [a0]` — the navigation selection and a
 * boost's line answer as targets, the printed label included. An instance that
 * turns the edit down is reported as the API error it is and changes nothing.
 * Filling the line from the post's source lives in ./edit.source.test.ts, the
 * refusals that send nothing in ./edit.refusals.test.ts, the media and poll the
 * edit keeps in ./edit.keeps.test.ts.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './edit';
import { DEFAULT_POLL_LIMITS } from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { ORIGIN, homeContext, putStatus } from '../../test/editHome';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';

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

/** Lain's own post, under a content warning the edit has to keep. */
const MINE = status('p', { spoiler_text: 'warning' });

/** A boost of {@link MINE}: its line is the one the command names. */
const BOOST = status('b', { reblog: MINE });

/** Another of lain's posts, newer than {@link MINE} and so labelled after it. */
const OTHER = status('o');

/** The status as the instance answers the PUT: lain's text, `edited_at` set. */
const EDITED = { ...MINE, content: '<p>new text</p>', edited_at: '2026-11-12T21:15:00.000Z' };

describe('/edit with text', () => {
  it('sends the new text and keeps the post content warning', async () => {
    putStatus('new text', EDITED);
    const context = homeContext(EDITING_PROFILE, [MINE]);

    const outcome = await command.run('a0 new text', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: EDITED });
    expect(context.print).toHaveBeenCalledWith('✎ edited [a0]');
    expect(context.setInput).not.toHaveBeenCalled();
  });

  it('edits the selected post when the line carries no label', async () => {
    putStatus('new text', EDITED);
    const context = homeContext(EDITING_PROFILE, [OTHER, MINE], 'p');

    const outcome = await command.run('new text', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith('✎ edited [a0]');
  });

  it('edits the original of a boost and names the boost line', async () => {
    putStatus('new text', EDITED);
    const context = homeContext(EDITING_PROFILE, [BOOST]);

    const outcome = await command.run('a0 new text', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: EDITED });
    expect(context.print).toHaveBeenCalledWith('✎ edited [a0]');
  });

  it('reports the instance turning the edit down', async () => {
    server.use(
      http.put(`${ORIGIN}/api/v1/statuses/:id`, () => {
        return HttpResponse.json({ error: 'Cannot edit a reblog' }, { status: 422 });
      }),
    );
    const context = homeContext(EDITING_PROFILE, [MINE]);

    const outcome = await command.run('a0 new text', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 422: Cannot edit a reblog' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });
});
