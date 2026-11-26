/**
 * Tests that the media window's text follows the language in use (decision
 * 19): the step buttons are named from the catalog.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MediaSteps } from './MediaControls';
import { I18nProvider } from '../../i18n/I18nProvider';
import { installFakeLocale } from '../../test/i18n';

describe('the media slice in another language', () => {
  it('names the step buttons from the catalog', () => {
    installFakeLocale({ features: { media: { next: 'XX next', previous: 'XX previous' } } });

    render(
      <I18nProvider>
        <MediaSteps n={1} onStep={vi.fn()} total={2} />
      </I18nProvider>,
    );

    expect(screen.getByRole('button', { name: 'XX next' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'XX previous' })).toBeDisabled();
  });
});
