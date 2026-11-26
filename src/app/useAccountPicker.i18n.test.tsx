/**
 * Tests that the account picker's text goes through `t()` (WFE-318, decision
 * 19): under a fake language the dialog's title, the description of a window
 * with no posting account and the remember scopes follow it.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAccountPicker } from './useAccountPicker';
import { I18nProvider } from '../i18n/I18nProvider';
import type { FeedSpec } from '../state/feeds';
import { feedWindowOpen } from '../state/feedWindow';
import { AppStateProvider } from '../state/StateContext';
import { stateAfter } from '../test/appSessions';
import { installFakeLocale } from '../test/i18n';
import { ALICE, LAIN } from '../test/splitDesk';

const FEED: FeedSpec = { id: 'f1', name: 'main', sources: [] };

/** Mounts the hook and renders the box it hands back. */
function Host(): ReturnType<typeof useAccountPicker> {
  return useAccountPicker(false, () => false);
}

describe('the account picker in another language', () => {
  it('words the title, the description and the scopes', () => {
    installFakeLocale({
      app: {
        post_as: 'Publish as',
        post_no_account: 'Nobody yet',
        scope_everywhere: 'All over',
        scope_this_feed: 'Only {name}',
      },
    });
    const initial = stateAfter([
      { type: 'accounts', accounts: [LAIN, ALICE], activeKey: LAIN.key },
      { type: 'settings', settings: { feeds: [FEED] } },
      { type: 'windows', action: feedWindowOpen(FEED) },
      {
        type: 'openAccountPick',
        pick: { purpose: 'default', windowId: 'feed:-:f1' },
      },
    ]);

    render(
      <I18nProvider>
        <AppStateProvider initial={initial}>
          <Host />
        </AppStateProvider>
      </I18nProvider>,
    );

    expect(screen.getByRole('dialog', { name: 'Publish as' })).toHaveAccessibleDescription(
      'Nobody yet',
    );
    expect(screen.getByRole('radio', { name: 'Only main' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'All over' })).not.toBeChecked();
  });
});
