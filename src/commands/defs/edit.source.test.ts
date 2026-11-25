/**
 * Tests for `/edit` with no text on the line (WFE-268), over the shared MSW
 * server: the post's source — the plain text its author wrote — is read from
 * `GET /api/v1/statuses/<id>/source` and a composer window bound to the post
 * opens, as the account of its line, holding that text, the content warning
 * and the post's audience; it opens where `--in`, `openIn.composer` or
 * `replyIn` (default `split`) say, with nothing printed or put in the command
 * line. A boost stands for its original, a `--in` that names no placement is
 * refused, and a source read the instance turns down opens nothing. Sending
 * the edit lives in ./edit.test.ts, the refusals in ./edit.refusals.test.ts.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { command } from './edit';
import { DEFAULT_POLL_LIMITS } from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { composerFields } from '../../state/composerActions';
import { type AppAction, appReducer } from '../../state/reducer';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { ORIGIN, homeContextWith } from '../../test/editHome';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { windowId } from '../../windows/model';
import type { CommandContext } from '../types';

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

/** The first composer: the draft the command opens, as lain's line. */
const COMPOSER_ID = windowId({ kind: 'composer', accountKey: `${ORIGIN}#1`, target: '1' });

/** Lain's own unlisted post, and a boost of it: the line the label names. */
const MINE = status('p', { visibility: 'unlisted' });

const BOOST = status('b', { reblog: MINE });

/** The source read of the status path, answering {@link body}. */
function getSource(body: Record<string, unknown>): void {
  server.use(
    http.get(`${ORIGIN}/api/v1/statuses/:id/source`, ({ request }) => {
      expect(request.headers.get('Authorization')).toBe('Bearer token');
      expect(new URL(request.url).pathname).toBe('/api/v1/statuses/p/source');

      return HttpResponse.json(body);
    }),
  );
}

/** A context whose home window shows {@link posts}, {@link selectedId} selected, under {@link settings}. */
function context(
  posts = [MINE],
  selectedId: string | null = null,
  settings: Settings = DEFAULT_SETTINGS,
): CommandContext {
  return homeContextWith(EDITING_PROFILE, posts, { selectedId, settings });
}

/** The actions the command dispatched, as they were given. */
function dispatched(given: CommandContext): AppAction[] {
  return vi.mocked(given.dispatch).mock.calls.map(([action]) => action);
}

describe('/edit without text', () => {
  it('opens a composer bound to the post, split beside the focused pane', async () => {
    getSource({ id: 'p', text: 'what lain wrote', spoiler_text: 'warning' });
    const given = context();

    const outcome = await command.run('a0', given);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatched(given)[0]).toStrictEqual({
      type: 'openPlaced',
      action: {
        type: 'open',
        ref: { kind: 'composer', accountKey: `${ORIGIN}#1`, target: '1' },
        title: 'compose',
      },
      placement: 'split',
    });
    expect(given.setInput).not.toHaveBeenCalled();
    expect(given.print).not.toHaveBeenCalled();
  });

  it('fills the source text, the warning and the post’s audience, binding the post', async () => {
    getSource({ id: 'p', text: 'what lain wrote', spoiler_text: 'warning' });
    const given = context();

    await command.run('a0', given);
    const applied = dispatched(given).reduce(appReducer, given.state);

    expect(composerFields(applied, COMPOSER_ID)).toStrictEqual({
      text: 'what lain wrote',
      spoiler: 'warning',
      visibility: 'unlisted',
      editing: { status: MINE, accountKey: `${ORIGIN}#1` },
    });
  });

  it('edits the selected post when no label is given, a boost as its original', async () => {
    getSource({ id: 'p', text: 'raw', spoiler_text: '' });
    const given = context([BOOST], 'b');

    const outcome = await command.run('', given);
    const applied = dispatched(given).reduce(appReducer, given.state);

    expect(outcome).toStrictEqual({ ok: true });
    expect(composerFields(applied, COMPOSER_ID).editing?.status).toStrictEqual(MINE);
  });

  it('opens in the float for --in float, with a label or without', async () => {
    getSource({ id: 'p', text: 'raw', spoiler_text: '' });
    const labelled = context();
    const alone = context([MINE], 'p');

    await command.run('a0 --in float', labelled);
    await command.run('--in float', alone);

    expect(dispatched(labelled)[0]).toMatchObject({ type: 'openPlaced', placement: 'float' });
    expect(dispatched(alone)[0]).toMatchObject({ type: 'openPlaced', placement: 'float' });
  });

  it('opens where replyIn says, and over it where openIn.composer says', async () => {
    getSource({ id: 'p', text: 'raw', spoiler_text: '' });
    const byReplyIn = context([MINE], null, { ...DEFAULT_SETTINGS, replyIn: 'float' });
    const byKind = context([MINE], null, {
      ...DEFAULT_SETTINGS,
      replyIn: 'float',
      openInByKind: { composer: 'vsplit' },
    });

    await command.run('a0', byReplyIn);
    await command.run('a0', byKind);

    expect(dispatched(byReplyIn)[0]).toMatchObject({ placement: 'float' });
    expect(dispatched(byKind)[0]).toMatchObject({ placement: 'vsplit' });
  });

  it('refuses a --in that names no placement, opening nothing', async () => {
    const given = context();

    const outcome = await command.run('a0 --in nowhere', given);

    expect(outcome.ok).toBe(false);
    expect(given.dispatch).not.toHaveBeenCalled();
  });

  it('reports a source read the instance turns down and opens nothing', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/:id/source`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 403 });
      }),
    );
    const given = context();

    const outcome = await command.run('a0', given);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 403: Record not found' });
    expect(given.dispatch).not.toHaveBeenCalled();
  });
});
