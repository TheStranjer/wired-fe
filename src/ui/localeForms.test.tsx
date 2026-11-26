/**
 * Tests that a rendered post card, poll and profile header show the figures
 * and plural words of the language in use (decision 19): German digit
 * grouping and day order, the catalog's own plural words, and a switch of
 * language that re-renders them.
 */
import { act, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { PollView } from './PollView';
import { PostCard } from './PostCard';
import { BASE_PROPS } from './postCardHarness';
import { WhoisBlock } from './WhoisBlock';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale } from '../test/i18n';

/** The German words the tests install. */
const GERMAN = {
  format: {
    boost_count: '{count, plural, one {# Boost} other {# Boosts}}',
    closed: 'beendet',
    closes: 'endet {time}',
    multiple_choice: '(Mehrfachauswahl)',
    reaction_label: '{name}, {count, plural, one {# Reaktion} other {# Reaktionen}}',
    reply_to_counted:
      'Antwort auf Beitrag {label} ({count, plural, one {# Antwort} other {# Antworten}})',
    vote_count: '{count, plural, one {# Stimme} other {# Stimmen}}',
    whois_counts:
      'Beiträge {posts, number} · folgt {following, number} · Follower {followers, number} · seit {joined}',
  },
};

/** Install the German catalog and render {@link ui} under the provider. */
function renderGerman(ui: JSX.Element): HTMLElement {
  installFakeLocale(GERMAN, 'de');
  return render(<I18nProvider>{ui}</I18nProvider>).container;
}

describe('a post card in another language', () => {
  it('groups the counts and uses the catalog’s plural words', () => {
    renderGerman(
      <PostCard
        {...BASE_PROPS}
        actionLines={{
          reply: { line: '/reply a3', prefill: true },
          boost: { line: '/boost a3', prefill: false },
        }}
        counts={{ replies: 1234, boosts: 1, favourites: 0 }}
        reactions={[{ name: '🔥', count: 12345, me: false, url: null }]}
      />,
    );

    const reply = screen.getByRole('button', { name: 'Antwort auf Beitrag a3 (1.234 Antworten)' });

    expect(reply).toHaveAttribute('data-count', '1.234');
    expect(screen.getByRole('button', { name: 'Boost post a3' })).toHaveAttribute(
      'title',
      '1 Boost',
    );
    expect(screen.getByRole('img', { name: '🔥, 12.345 Reaktionen' })).toHaveTextContent('12.345');
    expect(screen.getByText('23:04')).toBeInTheDocument();
  });

  it('shows the 12-hour clock of the language in use', () => {
    renderGerman(<PostCard {...BASE_PROPS} clockFormat="12h" />);

    expect(screen.getByText(/^11:04/u)).toHaveAttribute('datetime', BASE_PROPS.date.toISOString());
  });
});

describe('a poll in another language', () => {
  const poll = {
    options: [
      { title: 'ja', votes: 617 },
      { title: 'nein', votes: 617 },
    ],
    totalVotes: 1234,
    expiresAt: new Date(2026, 0, 2, 23, 59),
    expired: false,
    multiple: true,
    ownVotes: [],
    voted: true,
  };

  it('writes the percentages, the votes, the deadline and the kind in its words', () => {
    const container = renderGerman(<PollView clockFormat="24h" label="a3" poll={poll} />);

    expect(container).toHaveTextContent('1.234 Stimmen · endet 23:59 · (Mehrfachauswahl)');
    expect(container.textContent).toMatch(/50\s%/u);
  });

  it('says the poll is over in its words', () => {
    renderGerman(<PollView clockFormat="24h" label="a3" poll={{ ...poll, expired: true }} />);

    expect(screen.getByText(/beendet/u)).toBeVisible();
  });
});

describe('a profile header in another language', () => {
  it('writes the counters, the joined day and the words in the language in use', () => {
    renderGerman(
      <WhoisBlock
        bioHtml=""
        counts={{ posts: 1234, following: 2, followers: 12345 }}
        displayName="Lain"
        fields={[]}
        handle="lain@wired.example"
        joined={new Date(Date.UTC(2026, 10, 24, 12))}
        relationships={{ following: false, followedBy: false, blocked: false, muted: false }}
      />,
    );

    expect(
      screen.getByText('Beiträge 1.234 · folgt 2 · Follower 12.345 · seit 24.11.2026'),
    ).toBeInTheDocument();
  });

  it('follows a switch of language', () => {
    const props = {
      bioHtml: '',
      counts: { posts: 1234, following: 2, followers: 3 },
      displayName: 'Lain',
      fields: [],
      handle: 'lain@wired.example',
      joined: new Date(Date.UTC(2026, 10, 24, 12)),
      relationships: { following: false, followedBy: false, blocked: false, muted: false },
    };
    render(
      <I18nProvider>
        <WhoisBlock {...props} />
      </I18nProvider>,
    );

    expect(
      screen.getByText('posts 1,234 · following 2 · followers 3 · joined 2026-11-24'),
    ).toBeInTheDocument();

    act(() => {
      installFakeLocale(GERMAN, 'de');
    });

    expect(
      screen.getByText('Beiträge 1.234 · folgt 2 · Follower 3 · seit 24.11.2026'),
    ).toBeInTheDocument();
  });
});
