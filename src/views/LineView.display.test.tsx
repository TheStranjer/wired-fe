/**
 * Tests for the display settings reaching a post with media (decision 15,
 * WFE-235): every combination of `density`, `avatars` and `images` draws the
 * right components and requests only the pictures it should, a window's own
 * override wins, and changing a setting or an override re-renders at once.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { LineView } from './LineView';
import type { StoredAccount } from '../accounts/accountStore';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import type { Density, Settings } from '../state/settings';
import { AppStateProvider, useAppDispatch } from '../state/StateContext';
import { status } from '../test/fixtures';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const ACCOUNT_KEY = `${ORIGIN}#acct-1`;

/** The account the window under test belongs to. */
const ACCOUNT: StoredAccount = {
  key: ACCOUNT_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The home window on {@link ACCOUNT}, and the id its ref names. */
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT_KEY, target: null };
const HOME = windowId(REF);

/** The picture URL of the one attachment's preview. */
const PREVIEW = 'https://wired.example/media/m1.small.png';

/** One described image attachment. */
const ATTACHMENT = {
  id: 'm1',
  type: 'image',
  url: 'https://wired.example/media/m1.png',
  preview_url: PREVIEW,
  description: 'a wall',
};

/** The home window over `settings` holding one post with one image. */
function seeded(settings: Settings): AppState {
  const signed = coreReducer(initialAppState(settings), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT_KEY,
  });
  const opened = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
  return appReducer(opened, {
    type: 'statuses',
    windowId: HOME,
    statuses: [status('pic', { media_attachments: [ATTACHMENT] })],
    where: 'newer',
  });
}

/** Buttons that change a setting or the window's override through the reducer. */
function Controls(): JSX.Element {
  const go = useAppDispatch();
  return (
    <>
      <button
        onClick={() => {
          go({ type: 'settings', settings: { images: false } });
        }}
        type="button"
      >
        images off
      </button>
      <button
        onClick={() => {
          go({ type: 'settings', settings: { avatars: false } });
        }}
        type="button"
      >
        avatars off
      </button>
      <button
        onClick={() => {
          go({
            type: 'windows',
            action: { type: 'setDisplay', id: HOME, overrides: { images: true } },
          });
        }}
        type="button"
      >
        window images on
      </button>
    </>
  );
}

/** Render the home window's lines over {@link state}, with the controls. */
function renderLines(state: AppState): void {
  render(
    <AppStateProvider initial={state}>
      <Controls />
      {bufferFor(state, HOME).lines.map((line) => (
        <LineView key={line.key} line={line} windowId={HOME} />
      ))}
    </AppStateProvider>,
  );
}

/** The `src` of every picture the page asks the network for. */
function requested(): string[] {
  return Array.from(document.querySelectorAll('img')).map((img) => img.getAttribute('src') ?? '');
}

/** Settings for one cell of the density × avatars × images table. */
function cell(density: Density, avatars: boolean, images: boolean): Settings {
  return { ...initialAppState().settings, density, avatars, images };
}

/** One cell of the density × avatars × images table. */
type Cell = [Density, boolean, boolean];

/** Every cell: both densities, avatars on and off, images on and off. */
const CELLS: Cell[] = (['cards', 'lines'] as const).flatMap((density) =>
  [true, false].flatMap((avatars): Cell[] => [
    [density, avatars, true],
    [density, avatars, false],
  ]),
);

describe('LineView with media', () => {
  it.each(CELLS)(
    '%s, avatars %s, images %s: draws what is on and requests only that',
    (...args) => {
      const [density, avatars, images] = args;
      renderLines(seeded(cell(density, avatars, images)));
      const grid = density === 'cards' && images;
      const avatar = density === 'cards' && avatars;

      expect(screen.queryByRole('button', { name: '[IMG 1/1: a wall]' }) === null).toBe(grid);
      expect(screen.queryByRole('img', { name: 'a wall' }) === null).toBe(!grid);
      expect(requested().includes(PREVIEW)).toBe(grid);
      expect(screen.queryByRole('img', { name: 'Avatar of @lain@wired.example' }) === null).toBe(
        !avatar,
      );
      expect(requested().includes('https://wired.example/avi.png')).toBe(avatar);
    },
  );
});

describe('LineView display toggled live', () => {
  it('swaps the grid for placeholder lines when images are turned off', () => {
    renderLines(seeded(cell('cards', true, true)));

    expect(requested()).toContain(PREVIEW);

    fireEvent.click(screen.getByRole('button', { name: 'images off' }));

    expect(requested()).not.toContain(PREVIEW);
    expect(screen.getByRole('button', { name: '[IMG 1/1: a wall]' })).toBeInTheDocument();
  });

  it('drops the avatar when avatars are turned off', () => {
    renderLines(seeded(cell('cards', true, true)));

    fireEvent.click(screen.getByRole('button', { name: 'avatars off' }));

    expect(screen.queryByRole('img', { name: 'Avatar of @lain@wired.example' })).toBeNull();
  });

  it('draws the grid again when the window overrides images on', () => {
    renderLines(seeded(cell('cards', true, false)));

    expect(requested()).not.toContain(PREVIEW);

    fireEvent.click(screen.getByRole('button', { name: 'window images on' }));

    expect(requested()).toContain(PREVIEW);
  });
});
