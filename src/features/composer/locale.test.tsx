/**
 * Tests that the composer slice's text follows the language in use
 * (decision 19): the "Post as" label is read from the catalog.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { openedComposer } from './composerSession';
import { ComposerWindow } from './ComposerWindow';
import { PostAs } from './PostAs';
import { I18nProvider } from '../../i18n/I18nProvider';
import { AppStateProvider } from '../../state/StateContext';
import { installFakeLocale } from '../../test/i18n';

describe('the composer slice in another language', () => {
  it('names the account picker from the catalog', () => {
    installFakeLocale({ features: { composer: { post_as: 'XX post as' } } });

    render(
      <I18nProvider>
        <PostAs accounts={[]} onPick={vi.fn()} value={null} />
      </I18nProvider>,
    );

    expect(screen.getByRole('combobox', { name: 'XX post as' })).toBeVisible();
  });

  it('names the log region of a window nobody has from the catalog', () => {
    installFakeLocale({ features: { composer: { log_label: 'XX compose' } } });

    render(
      <I18nProvider>
        <AppStateProvider initial={openedComposer()}>
          <ComposerWindow windowId="composer:gone:9" />
        </AppStateProvider>
      </I18nProvider>,
    );

    expect(screen.getByRole('log', { name: 'XX compose' })).toBeInTheDocument();
  });
});
