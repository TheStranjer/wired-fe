/**
 * Tests that the people window's text follows the language in use (decision
 * 19): the notice for a closed watched window is read from the catalog.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { I18nProvider } from '../../i18n/I18nProvider';
import { initialAppState } from '../../state/appState';
import { AppStateProvider } from '../../state/StateContext';
import { installFakeLocale } from '../../test/i18n';

describe('the people slice in another language', () => {
  it('words its notice from the catalog', () => {
    installFakeLocale({ features: { people: { window_closed: 'XX closed' } } });
    const { Component } = windowKind;

    render(
      <I18nProvider>
        <AppStateProvider initial={initialAppState()}>
          <Component windowId="people:-:nowhere" />
        </AppStateProvider>
      </I18nProvider>,
    );

    expect(screen.getByText('XX closed')).toBeVisible();
  });
});
