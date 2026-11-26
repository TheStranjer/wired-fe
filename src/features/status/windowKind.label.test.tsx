/**
 * Tests that the status window's log region is named from the catalog
 * (decision 19), not from a literal in the component.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { I18nProvider } from '../../i18n/I18nProvider';
import { initialAppState } from '../../state/appState';
import { AppStateProvider } from '../../state/StateContext';
import { installFakeLocale } from '../../test/i18n';
import { STATUS_WINDOW_ID } from '../../windows/model';

describe('the status window in another language', () => {
  it('names its log region from the catalog', () => {
    installFakeLocale({ features: { status: { log_label: 'XX status' } } });
    const { Component } = windowKind;

    render(
      <I18nProvider>
        <AppStateProvider initial={initialAppState()}>
          <Component windowId={STATUS_WINDOW_ID} />
        </AppStateProvider>
      </I18nProvider>,
    );

    expect(screen.getByRole('log', { name: 'XX status' })).toBeInTheDocument();
  });
});
