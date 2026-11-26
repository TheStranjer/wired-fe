/**
 * Test that the line a window with no account prints follows the language
 * (decision 19, WFE-321).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TimelineWindow } from './TimelineWindow';
import type { FetchPage } from './useTimeline';
import { ok } from '../lib/result';
import { coreReducer, initialAppState } from '../state/appState';
import { AppStateProvider } from '../state/StateContext';
import { installFakeLocale } from '../test/i18n';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const REF: WindowRef = { kind: 'home', accountKey: 'https://wired.example#gone', target: null };

/** Fetches nothing: the window has no account to ask as. */
const EMPTY: FetchPage = async () =>
  await Promise.resolve(ok({ items: [], links: { next: null, prev: null } }));

describe(TimelineWindow, () => {
  it('says in the language in use that the window has no account', async () => {
    installFakeLocale({ views: { paging: { no_account: 'NO ACCOUNT HERE' } } });
    const state = coreReducer(initialAppState(), {
      type: 'windows',
      action: { type: 'open', ref: REF, title: 'home' },
    });
    render(
      <AppStateProvider initial={state}>
        <TimelineWindow fetchPage={EMPTY} label="home" windowId={windowId(REF)} />
      </AppStateProvider>,
    );

    const line = await screen.findByText('NO ACCOUNT HERE');

    expect(line).toBeInTheDocument();
  });
});
