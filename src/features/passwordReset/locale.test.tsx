/**
 * Tests that the new-password slice's text follows the language in use
 * (decision 19): the box's label and fields are read from the catalog.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PasswordResetForm } from './PasswordResetForm';
import { I18nProvider } from '../../i18n/I18nProvider';
import { installFakeLocale } from '../../test/i18n';

describe('the password reset slice in another language', () => {
  it('labels the box and its fields from the catalog', () => {
    installFakeLocale({
      features: { password_reset: { form_label: 'XX reset', new_password: 'XX new' } },
    });

    render(
      <I18nProvider>
        <PasswordResetForm askInstance={false} onClose={vi.fn()} onSubmit={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getByRole('form', { name: 'XX reset' })).toBeVisible();
    expect(screen.getByLabelText('XX new')).toBeVisible();
  });
});
