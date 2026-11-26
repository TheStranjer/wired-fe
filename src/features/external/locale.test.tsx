/**
 * Tests that the external-login slice's text follows the language in use
 * (decision 19): a refusal and a button are read from the catalog.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { settleRedirect } from './outcome';
import { Message } from './Parts';
import { I18nProvider } from '../../i18n/I18nProvider';
import { installFakeLocale } from '../../test/i18n';

describe('the external slice in another language', () => {
  it('words a refused redirect from the catalog', () => {
    installFakeLocale({ features: { external: { unsafe_redirect: 'XX unsafe' } } });

    expect(settleRedirect('javascript:alert(1)', vi.fn())).toStrictEqual({
      kind: 'error',
      message: 'XX unsafe',
    });
  });

  it('labels the way out from the catalog', () => {
    installFakeLocale({ features: { external: { close_button: 'XX close' } } });
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <Message onClose={onClose} role="status" text="hello" />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'XX close' }));

    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });
});
