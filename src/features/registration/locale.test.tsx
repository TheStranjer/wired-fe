/**
 * Tests that the sign-up slice's text follows the language in use (decision
 * 19): the box's label and fields are read from the catalog.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RegistrationForm } from './RegistrationForm';
import { I18nProvider } from '../../i18n/I18nProvider';
import { installFakeLocale } from '../../test/i18n';

describe('the registration slice in another language', () => {
  it('labels the box and its fields from the catalog', () => {
    installFakeLocale({
      features: { registration: { form_label: 'XX register', username: 'XX user' } },
    });

    render(
      <I18nProvider>
        <RegistrationForm askInstance={false} onClose={vi.fn()} onSubmit={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getByRole('form', { name: 'XX register' })).toBeVisible();
    expect(screen.getByLabelText('XX user')).toBeVisible();
  });
});
