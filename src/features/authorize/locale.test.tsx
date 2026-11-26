/**
 * Tests that the authorization slice's text follows the language in use
 * (decision 19): a permission, a refusal and a button are read from the
 * catalog, not typed at the call site.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CodeView } from './CodeView';
import { describeAuthorizeError } from './describeError';
import { describeScope } from './scopeWords';
import { I18nProvider } from '../../i18n/I18nProvider';
import { installFakeLocale } from '../../test/i18n';

describe('the authorize slice in another language', () => {
  it('words a permission and a refusal from the catalog', () => {
    installFakeLocale({
      features: { authorize: { whole_read: 'XX read', not_trusted: 'XX not trusted' } },
    });

    expect(describeScope('read')).toBe('XX read (read)');
    expect(
      describeAuthorizeError({ kind: 'http', status: 403, message: 'unauthorized_client' }),
    ).toBe('XX not trusted');
  });

  it('labels its buttons from the catalog', () => {
    installFakeLocale({ features: { authorize: { close_button: 'XX close' } } });

    render(
      <I18nProvider>
        <CodeView code="abc" onClose={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getByRole('button', { name: 'XX close' })).toBeVisible();
  });
});
