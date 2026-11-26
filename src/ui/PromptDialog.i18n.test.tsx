/**
 * Tests that the prompt dialog takes its buttons and its suggestion list's
 * name from the language in use (decision 19).
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PromptDialog } from './PromptDialog';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale, resetFakeLocale } from '../test/i18n';

describe(PromptDialog, () => {
  afterEach(resetFakeLocale);

  it('words its buttons and its suggestions in the language in use', () => {
    installFakeLocale({
      ui: { prompt_dialog: { cancel: 'XX no', ok: 'XX yes', suggestions: 'XX words {title}' } },
    });
    render(
      <I18nProvider>
        <PromptDialog
          field="Handle"
          onCancel={() => undefined}
          onSubmit={() => undefined}
          placeholder="@user"
          title="Open profile"
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('button', { name: 'XX yes' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'XX no' })).toBeVisible();
    expect(
      screen.getByLabelText('XX words Open profile', { selector: '[role=listbox]' }),
    ).toBeInTheDocument();
  });
});
