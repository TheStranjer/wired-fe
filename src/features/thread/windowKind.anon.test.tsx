/**
 * Tests for the thread window of a signed-out visitor (WFE-340): it loads its
 * conversation with no token and so no `Authorization` header, shows a one-line
 * note to sign in where the reply box would be, and reports a 403 as the
 * instance's refusal of the read.
 */
import { render, screen } from '@testing-library/react';
import { HttpResponse, type JsonBodyType, http } from 'msw';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import { ANON_KEY, ANON_ORIGIN } from '../../test/anonWindow';
import { server } from '../../test/server';
import { FIRST_DOWN, FIRST_UP, THREAD_TARGET } from '../../test/threadWindow';
import { windowId } from '../../windows/model';
import type { WindowRef } from '../../windows/model';

const REF: WindowRef = { kind: 'thread', accountKey: ANON_KEY, target: '5' };
const ID = windowId(REF);

/** A visitor with no account and the signed-out thread window of post five open. */
const VISITOR = appReducer(initialAppState(), {
  type: 'windows',
  action: { type: 'open', ref: REF, title: 'thread/5' },
});

/** Prints the signed-out keys the instance refused. */
function Refused(): JSX.Element {
  return <output aria-label="refused">{[...useAppState().anonRefused].join(',')}</output>;
}

/** Render the thread window over {@link VISITOR}, with the refusals printed beside it. */
function renderWindow(): void {
  const { Component } = windowKind;
  render(
    <AppStateProvider initial={VISITOR}>
      <Component windowId={ID} />
      <Refused />
    </AppStateProvider>,
  );
}

/** Serve the conversation, recording the Authorization header of every request; {@link code} refuses with it. */
function serve(code: number | null): (string | null)[] {
  const seen: (string | null)[] = [];
  const answer = (request: Request, body: JsonBodyType): Response => {
    seen.push(request.headers.get('Authorization'));
    return code === null
      ? HttpResponse.json(body)
      : HttpResponse.json({ error: 'refused' }, { status: code });
  };
  server.use(
    http.get(`${ANON_ORIGIN}/api/v1/statuses/5`, ({ request }) => answer(request, THREAD_TARGET)),
    http.get(`${ANON_ORIGIN}/api/v1/statuses/5/context`, ({ request }) =>
      answer(request, { ancestors: [FIRST_UP], descendants: [FIRST_DOWN] }),
    ),
  );
  return seen;
}

describe('the thread window of a signed-out visitor', () => {
  it('loads the conversation with no Authorization header', async () => {
    const seen = serve(null);
    renderWindow();

    await screen.findByText('the fourth wall');

    expect(seen).toHaveLength(2);
    expect(seen.every((header) => header === null)).toBe(true);
  });

  it('shows a note to sign in where the reply box would be', async () => {
    serve(null);
    renderWindow();

    await screen.findByText('the fourth wall');

    expect(screen.getByText('Sign in to reply. Type /connect to log in.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('reports a 403 as the instance refusing the read', async () => {
    serve(403);
    renderWindow();

    await screen.findByText(ANON_KEY);

    expect(screen.getByLabelText('refused')).toHaveTextContent(ANON_KEY);
  });
});
