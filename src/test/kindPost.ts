/**
 * A test helper for window kinds that post as their window's account without
 * showing a timeline (WFE-283): runs the kind's `onPost` against a served
 * create endpoint and reports what came back, what the instance was sent and
 * what the post asked the reducer for.
 */
import { HttpResponse, http } from 'msw';
import { type Mock, vi } from 'vitest';

import { status } from './fixtures';
import { server } from './server';
import type { AppState } from '../state/appState';
import type { Draft } from '../state/draft';
import type { PostContext, WindowKindDefinition } from '../state/windowKind';
import type { WindowState } from '../windows/model';

/** What one run of a kind's `onPost` did. */
type KindPostRun = {
  /** The error the post resolved to, or null when it went through. */
  readonly result: string | null;
  /** The JSON bodies the create endpoint received. */
  readonly bodies: readonly unknown[];
  /** The reducer asks the post made. */
  readonly dispatch: Mock<PostContext['dispatch']>;
};

/**
 * Posts {@link text} through the `onPost` of {@link kind} for {@link win}
 * over {@link state} — {@link text} is a draft's text, or the whole draft; the instance at {@link origin} answers the create with a
 * status, or with a 422 when `target.refused`.
 */
export async function runKindPost(
  kind: Pick<WindowKindDefinition, 'onPost'>,
  target: {
    readonly state: AppState;
    readonly win: WindowState;
    readonly origin: string;
    readonly refused?: boolean;
  },
  text: string | Draft,
): Promise<KindPostRun> {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${target.origin}/api/v1/statuses`, async ({ request }) => {
      bodies.push(await request.json());
      return target.refused === true
        ? HttpResponse.json({ error: 'Text is too long' }, { status: 422 })
        : HttpResponse.json(status('42'));
    }),
  );
  const dispatch = vi.fn<PostContext['dispatch']>();
  const context: PostContext = { state: target.state, dispatch, now: () => new Date() };
  if (kind.onPost === undefined) {
    throw new Error('the kind takes no posts');
  }
  const result = await kind.onPost(typeof text === 'string' ? { text } : text, target.win, context);
  return { result, bodies, dispatch };
}
