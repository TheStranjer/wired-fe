/**
 * Tests that a post card takes its accessible name and reply marker from the
 * language in use (decision 19).
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PostCard } from './PostCard';
import { BASE_PROPS } from './postCardHarness';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale, resetFakeLocale } from '../test/i18n';

describe(PostCard, () => {
  afterEach(resetFakeLocale);

  it('words its name and reply marker in the language in use', () => {
    installFakeLocale({
      ui: {
        post_article: { direct: 'XX dm {label} {handle}' },
        post_card_parts: { reply_to: 'XX re {label}' },
      },
    });
    render(
      <I18nProvider>
        <PostCard {...BASE_PROPS} replyTo="a2" visibility="direct" />
      </I18nProvider>,
    );

    expect(screen.getByRole('article', { name: 'XX dm a3 @alice@m.example' })).toBeVisible();
    expect(screen.getByText('XX re a2')).toBeVisible();
  });
});
