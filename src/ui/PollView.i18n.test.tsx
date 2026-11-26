/**
 * Tests that a poll takes its own-vote tooltip from the language in use
 * (decision 19).
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PollView } from './PollView';
import type { PollViewData } from './PollView';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale, resetFakeLocale } from '../test/i18n';

const POLL: PollViewData = {
  options: [
    { title: 'yes', votes: 3 },
    { title: 'no', votes: 7 },
  ],
  totalVotes: 10,
  expiresAt: null,
  expired: false,
  multiple: false,
  ownVotes: [0],
  voted: true,
};

describe(PollView, () => {
  afterEach(resetFakeLocale);

  it('words the own vote in the language in use', () => {
    installFakeLocale({ ui: { poll_view: { own_vote: 'XX mine' } } });
    render(
      <I18nProvider>
        <PollView clockFormat="24h" label="a3" poll={POLL} />
      </I18nProvider>,
    );

    expect(screen.getByTitle('XX mine')).toBeInTheDocument();
  });
});
