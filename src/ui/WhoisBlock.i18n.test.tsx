/**
 * Tests that the whois block takes its counters line, relationship words and
 * verified mark from the language in use (decision 19).
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WhoisBlock } from './WhoisBlock';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale, resetFakeLocale } from '../test/i18n';

describe(WhoisBlock, () => {
  afterEach(resetFakeLocale);

  it('words the counters, relationships and verified mark in the language in use', () => {
    installFakeLocale({
      ui: {
        whois_block: {
          blocked: 'XX blocked',
          followed_by: 'XX they follow',
          following: 'XX you follow',
          muted: 'XX muted',
          verified: 'XX verified',
          verified_title: 'XX verified link',
        },
      },
    });
    const { container } = render(
      <I18nProvider>
        <WhoisBlock
          bioHtml=""
          counts={{ posts: 1, following: 2, followers: 3 }}
          displayName="Lain"
          fields={[{ name: 'site', valueHtml: 'x', verified: true }]}
          handle="lain@wired.example"
          joined={new Date(2024, 0, 2)}
          relationships={{ following: true, followedBy: true, blocked: true, muted: true }}
        />
      </I18nProvider>,
    );

    expect(container.textContent).toContain(
      'XX you follow · XX they follow · XX blocked · XX muted',
    );
    expect(screen.getByTitle('XX verified link')).toHaveTextContent('XX verified');
  });
});
