/**
 * Tests that the action bar and its more-menu take their words from the
 * language in use (decision 19): in a fake language every accessible name,
 * tooltip and menu row reads the fake catalog.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PostActions } from './PostActions';
import type { PostActionsProps } from './PostActions';
import type { PostActionLines } from './postActionTypes';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale, resetFakeLocale } from '../test/i18n';

const LINES: PostActionLines = Object.fromEntries(
  ['reply', 'boost', 'fav', 'react', 'bookmark', 'mute'].map((name) => [
    name,
    { line: `/${name} a3`, prefill: false },
  ]),
);

const PROPS: PostActionsProps = {
  label: 'a3',
  counts: { replies: 2, boosts: 1, favourites: 3 },
  mine: { boosted: false, favourited: false, bookmarked: false },
  own: false,
  lines: LINES,
  onAction: () => undefined,
  reactions: [],
  picker: { data: { custom: [], unicode: [] }, onOpen: () => undefined, onChoose: () => undefined },
};

/** Switch to the fake language and show the bar under the provider. */
function renderFake(): void {
  installFakeLocale({
    ui: {
      post_actions: {
        bookmark: 'XX bookmark {label}',
        boost: 'XX boost {label}',
        favourite: 'XX favourite {label}',
        group: 'XX actions {label}',
      },
      post_actions_more: { menu: 'XX more {label}', mute: 'XX mute' },
      react_button: { label: 'XX react {label}' },
    },
  });
  render(
    <I18nProvider>
      <PostActions {...PROPS} />
    </I18nProvider>,
  );
}

describe(PostActions, () => {
  afterEach(resetFakeLocale);

  it('names the group and its buttons in the language in use', () => {
    renderFake();

    expect(screen.getByRole('group', { name: 'XX actions a3' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'XX boost a3' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'XX favourite a3' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'XX bookmark a3' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'XX react a3' })).toBeVisible();
  });

  it('words the more-menu and its rows in the language in use', () => {
    renderFake();

    fireEvent.click(screen.getByRole('button', { name: 'XX more a3' }));

    expect(screen.getByRole('menuitem', { name: 'XX mute' })).toBeVisible();
  });
});
