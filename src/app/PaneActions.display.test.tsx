/**
 * Tests for the pane display menu (WFE-236): its checks come from the
 * window's effective values, each row runs the right `/display` line for its
 * own pane (focused first), reset shows only with overrides, and windows that
 * show no posts have no menu.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { DesktopView } from './DesktopView';
import { command as display } from '../commands/defs/display';
import { dispatchInput } from '../commands/dispatch';
import { buildRegistry } from '../commands/registry';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider, useAppDispatch, useAppState } from '../state/StateContext';
import { fakeCommandContext } from '../test/commandContext';
import { PostActionsProvider } from '../views/PostActionsContext';
import type { PostActions } from '../views/PostActionsContext';
import { windowId } from '../windows/model';
import type { WindowKind, WindowRef } from '../windows/model';

/** A window of the made-up kind `phantom`, named by `target`. */
function phantom(target: string): WindowRef {
  return { kind: 'phantom' as unknown as WindowKind, accountKey: null, target };
}

/** `phantom/a` and `phantom/b` side by side, with b focused. */
function twoPanes(): AppState {
  const open = (state: AppState, target: string): AppState =>
    appReducer(state, {
      type: 'windows',
      action: { type: 'open', ref: phantom(target), title: `phantom/${target}` },
    });
  const both = open(open(initialAppState(), 'a'), 'b');
  const back = appReducer(both, {
    type: 'windows',
    action: { type: 'activate', id: windowId(phantom('a')) },
  });
  return appReducer(back, {
    type: 'layout',
    action: { type: 'split', dir: 'row', windowId: windowId(phantom('b')) },
  });
}

/** Runs lines through the real `/display` over the live state, recording them. */
function Runner(props: { readonly lines: string[]; readonly children: JSX.Element }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const registry = buildRegistry([display]);
  if (!registry.ok) {
    throw new Error(registry.error);
  }
  const runRef = useRef<PostActions['run']>(() => undefined);
  useEffect(() => {
    runRef.current = ({ line }) => {
      props.lines.push(line);
      const context = fakeCommandContext({
        state,
        windows: state.windows,
        dispatch,
        dispatchWindows: (action) => {
          dispatch({ type: 'windows', action });
        },
        registry: registry.value,
      });
      void dispatchInput(line, context, async () => {
        await Promise.resolve();
      });
    };
  });
  const actions: PostActions = {
    linesFor: () => ({}),
    run: (line) => {
      runRef.current(line);
    },
  };
  return <PostActionsProvider actions={actions}>{props.children}</PostActionsProvider>;
}

/** Render the two panes over {@link initial}; returns the lines the runner saw. */
function setup(initial: AppState = twoPanes()): string[] {
  const lines: string[] = [];
  render(
    <AppStateProvider initial={initial}>
      <Runner lines={lines}>
        <DesktopView />
      </Runner>
    </AppStateProvider>,
  );
  return lines;
}

/** Open the display menu of the pane titled `title`. */
function openMenu(title: string): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: `Display options for ${title}` }));
  return screen.getByRole('menu', { name: `Display options for ${title}` });
}

describe('PaneActions display menu', () => {
  it('shows the effective values, all on and cards by default, with no reset', () => {
    setup();

    const menu = openMenu('phantom/a');

    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Cards, on' })).toBeChecked();
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Lines, off' })).not.toBeChecked();
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Avatars, on' })).toBeChecked();
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Images, on' })).toBeChecked();
    expect(within(menu).queryByRole('menuitem', { name: 'Reset to defaults' })).toBeNull();
  });

  it('runs the line for its own pane and marks the override afterwards', async () => {
    const lines = setup();

    openMenu('phantom/a');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Avatars, on' }));

    await waitFor(() => {
      expect(lines).toStrictEqual(['/display avatars off']);
    });
    const menu = openMenu('phantom/a');

    expect(
      within(menu).getByRole('menuitemcheckbox', { name: 'Avatars, off, overridden' }),
    ).not.toBeChecked();

    expect(within(menu).getByText('Avatars •')).toBeInTheDocument();

    expect(
      within(openMenu('phantom/b')).getByRole('menuitemcheckbox', { name: 'Avatars, on' }),
    ).toBeChecked();
  });

  it.each([
    ['Cards, on', '/display density cards'],
    ['Lines, off', '/display density lines'],
    ['Images, on', '/display images off'],
  ])('runs %s as %s', async (name, line) => {
    const lines = setup();

    openMenu('phantom/a');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name }));

    await waitFor(() => {
      expect(lines).toStrictEqual([line]);
    });
  });

  it('offers reset once the window overrides something and clears it', async () => {
    const lines = setup();
    openMenu('phantom/a');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Lines, off' }));
    await waitFor(() => {
      expect(lines).toHaveLength(1);
    });

    const menu = openMenu('phantom/a');

    expect(
      within(menu).getByRole('menuitemcheckbox', { name: 'Lines, on, overridden' }),
    ).toBeChecked();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Reset to defaults' }));

    await waitFor(() => {
      expect(lines).toStrictEqual(['/display density lines', '/display reset']);
    });

    expect(
      within(openMenu('phantom/a')).queryByRole('menuitem', { name: 'Reset to defaults' }),
    ).toBeNull();
  });

  it.each(['Images', 'Avatars'])('turns %s back on after it was turned off', async (label) => {
    const lines = setup();
    openMenu('phantom/a');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: `${label}, on` }));
    await waitFor(() => {
      expect(lines).toHaveLength(1);
    });

    openMenu('phantom/a');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: `${label}, off, overridden` }));

    await waitFor(() => {
      expect(lines).toStrictEqual([
        `/display ${label.toLowerCase()} off`,
        `/display ${label.toLowerCase()} on`,
      ]);
    });
  });

  it('has no display menu on the status window', () => {
    setup(initialAppState());

    expect(screen.queryByRole('button', { name: /^Display options/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close pane status' })).toBeInTheDocument();
  });

  it('has no display menu on a composer window', () => {
    const composer: WindowRef = { kind: 'composer', accountKey: null, target: null };
    setup(
      appReducer(initialAppState(), {
        type: 'windows',
        action: { type: 'open', ref: composer, title: 'composer' },
      }),
    );

    expect(screen.getByRole('button', { name: 'Close pane composer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Display options/ })).toBeNull();
  });
});
