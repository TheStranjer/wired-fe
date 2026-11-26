/**
 * Tests for the `Attach media…` row of the pane menus (WFE-288): choosing it
 * runs `/attach` through the pane runner, which opens the file dialog and
 * opens or splits no pane.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { DesktopView } from './DesktopView';
import { command as attach } from '../commands/defs/attach';
import { dispatchInput } from '../commands/dispatch';
import { buildRegistry } from '../commands/registry';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { fakeAttachments, fakeCommandContext } from '../test/commandContext';
import { twoPanes } from '../test/phantomPanes';
import { PostActionsProvider } from '../views/PostActionsContext';
import { activeDesktop } from '../windows/desktops';

/** The lines the buttons ran. */
const ran: string[] = [];

/** The alt texts `/attach` opened the file dialog with. */
const picked: string[] = [];

/** Runs lines through the real `/attach` command over the live state. */
function Runner(props: { readonly children: JSX.Element }): JSX.Element {
  const state = useAppState();
  const registry = buildRegistry([attach]);
  if (!registry.ok) {
    throw new Error(registry.error);
  }
  const attachments = fakeAttachments({
    pick: (description) => {
      picked.push(description);
    },
  });
  const context = fakeCommandContext({
    state,
    windows: state.windows,
    registry: registry.value,
    attachments,
  });
  return (
    <PostActionsProvider
      actions={{
        linesFor: () => ({}),
        run: ({ line }) => {
          ran.push(line);
          void dispatchInput(line, context, async () => {
            await Promise.resolve();
          });
        },
      }}
    >
      {props.children}
      <output aria-label="tree">{JSON.stringify(activeDesktop(state.layout).tree)}</output>
    </PostActionsProvider>
  );
}

/** Opens the menu of the first button called {@link name}. */
function openFirst(name: string): void {
  const [button] = screen.getAllByRole('button', { name });
  if (button === undefined) {
    throw new Error(`no ${name} button`);
  }
  fireEvent.click(button);
}

describe('the Attach media… row', () => {
  beforeEach(() => {
    ran.length = 0;
    picked.length = 0;
    render(
      <AppStateProvider initial={twoPanes()}>
        <Runner>
          <DesktopView />
        </Runner>
      </AppStateProvider>,
    );
  });

  it.each(['Split side by side', 'Split stacked'])(
    'in the %s menu runs /attach, opens the file dialog and opens no pane',
    async (name) => {
      const before = screen.getByLabelText('tree').textContent;

      openFirst(name);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Attach media…' }));

      await waitFor(() => {
        expect(picked).toStrictEqual(['']);
      });

      expect(ran).toStrictEqual(['/attach']);
      expect(screen.getByLabelText('tree').textContent).toBe(before);
    },
  );
});
