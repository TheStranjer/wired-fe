/**
 * Tests for a direct message drawn as a card (WFE-234): the `✉ DM` strip
 * naming sender and recipients, the accessible name that says it is a direct
 * message, and the chat-bubble placement a DM window gives it, where the
 * viewer's own bubble is named `you` and a continuation drops its header. A
 * post that is not direct reads exactly as before.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PostCard } from './PostCard';
import type { PostCardProps } from './PostCard';
import { BASE_PROPS as CARD_PROPS } from './postCardHarness';

const BASE_PROPS: PostCardProps = {
  ...CARD_PROPS,
  label: 'a4',
  author: { ...CARD_PROPS.author, handle: 'alice@m.example' },
  contentHtml: '<p>are you there</p>',
  visibility: 'direct',
  recipients: [
    { handle: 'lain@m.example', self: true },
    { handle: 'bob@m.example', self: false },
  ],
};

/** Render one card over {@link BASE_PROPS} with `overrides`. */
function renderCard(overrides: Partial<PostCardProps> = {}): void {
  render(<PostCard {...BASE_PROPS} {...overrides} />);
}

describe('PostCard direct messages', () => {
  it('shows who the message is between, calling the viewer you', () => {
    renderCard();

    expect(screen.getByText('✉ DM alice@m.example → you, bob@m.example')).toBeInTheDocument();
  });

  it('calls the viewer you as the sender too', () => {
    renderCard({
      author: { ...BASE_PROPS.author, self: true },
      recipients: [{ handle: 'alice@m.example', self: false }],
    });

    expect(screen.getByText('✉ DM you → alice@m.example')).toBeInTheDocument();
  });

  it('names only the sender when the message names nobody else', () => {
    renderCard({ recipients: [] });

    expect(screen.getByText('✉ DM alice@m.example')).toBeInTheDocument();
  });

  it('is named as a direct message with its label and sender', () => {
    renderCard();

    expect(
      screen.getByRole('article', { name: 'Direct message a4 from @alice@m.example' }),
    ).toBeInTheDocument();
  });

  it('leaves a public post named and headed as before', () => {
    renderCard({ visibility: 'public' });

    expect(
      screen.getByRole('article', { name: 'Post a4 by @alice@m.example' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/✉ DM/)).toBeNull();
  });
});

describe('PostCard chat bubbles', () => {
  it('names the sender and shows no strip or avatar in a conversation', () => {
    renderCard({ chat: { own: false, collapsed: false } });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText(/✉ DM/)).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('calls the viewer you on their own bubble', () => {
    renderCard({
      author: { ...BASE_PROPS.author, self: true },
      chat: { own: true, collapsed: false },
    });

    expect(screen.getByText('you')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).toBeNull();
  });

  it('drops the name of a continuation but keeps its label and body', () => {
    renderCard({ chat: { own: false, collapsed: true } });

    expect(screen.queryByText('Alice')).toBeNull();
    expect(screen.queryByRole('button', { name: '@alice@m.example' })).toBeNull();
    expect(screen.getByText('[a4]')).toBeInTheDocument();
    expect(screen.getByText('are you there')).toBeInTheDocument();
  });
});
