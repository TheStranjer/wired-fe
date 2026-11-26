/**
 * Tests that the metadata suffix takes its audience words, own-mark tooltips
 * and reaction names from the language in use (decision 19).
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PostMeta } from './PostMeta';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale, resetFakeLocale } from '../test/i18n';

/** Switch to the fake language and show a suffix with every own mark. */
function renderFake(): void {
  installFakeLocale({
    ui: {
      post_meta: {
        audience_private: 'XX followers',
        edited: 'XX edited',
        you_boosted: 'XX you boosted',
        you_bookmarked: 'XX you bookmarked',
        you_favourited: 'XX you favourited',
        you_reacted: 'XX you reacted {name}',
      },
    },
  });
  render(
    <I18nProvider>
      <PostMeta
        counts={{ replies: 0, boosts: 1, favourites: 2 }}
        edited
        mine={{ boosted: true, favourited: true, bookmarked: true }}
        reactions={[{ name: '🔥', count: 2, me: true, url: null }]}
        visibility="private"
      />
    </I18nProvider>,
  );
}

describe(PostMeta, () => {
  afterEach(resetFakeLocale);

  it('words the audience and the edit mark in the language in use', () => {
    renderFake();

    expect(screen.getByText('XX followers', { selector: 'span span' })).toBeInTheDocument();
    expect(screen.getByText('XX edited')).toBeInTheDocument();
  });

  it('words the own marks and the reaction in the language in use', () => {
    renderFake();

    expect(screen.getByTitle('XX you boosted')).toBeInTheDocument();
    expect(screen.getByTitle('XX you favourited')).toBeInTheDocument();
    expect(screen.getByTitle('XX you bookmarked')).toBeInTheDocument();
    expect(screen.getByTitle('XX you reacted 🔥')).toBeInTheDocument();
  });
});
