/**
 * Tests that the feed editor's text follows the language in use (decision
 * 19): its buttons and the reason an account cannot be ticked are read from
 * the catalog.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { blockedReason } from './blockedReason';
import { EditorActions } from './EditorActions';
import { I18nProvider } from '../../i18n/I18nProvider';
import { installFakeLocale } from '../../test/i18n';

describe('the feed editor in another language', () => {
  it('labels its buttons from the catalog', () => {
    installFakeLocale({ features: { feed_editor: { save_button: 'XX save' } } });

    render(
      <I18nProvider>
        <EditorActions
          save={{
            error: null,
            busy: false,
            saved: false,
            dirty: true,
            save: vi.fn(),
            remove: null,
          }}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('button', { name: 'XX save' })).toBeEnabled();
  });

  it('words why an account cannot be ticked from the catalog', () => {
    installFakeLocale({ features: { feed_editor: { sign_in_expired: 'XX expired' } } });

    expect(blockedReason('a', new Set(['a']))).toBe('XX expired');
  });
});
