/**
 * Tests for the split buttons of a pane's title bar (WFE-229): `┃▾` and `━▾`
 * split the pane whose button was clicked, not the focused one, with the view
 * chosen from the menu; the rows that ask for an argument open a dialog and
 * run the finished line (WFE-269), `Existing window…` fills the command line
 * for the user instead; and the menu offers only what the registry can run.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { DesktopView } from './DesktopView';
import { command as split } from '../commands/defs/split';
import { command as unsplit } from '../commands/defs/unsplit';
import { command as vsplit } from '../commands/defs/vsplit';
import { dispatchInput } from '../commands/dispatch';
import { buildRegistry } from '../commands/registry';
import { AppStateProvider, useAppDispatch, useAppState } from '../state/StateContext';
import { fakeCommandContext } from '../test/commandContext';
import { twoPanes } from '../test/phantomPanes';
import { PostActionsProvider } from '../views/PostActionsContext';
import type { PostActions } from '../views/PostActionsContext';
import { activeDesktop } from '../windows/desktops';
import type { SplitTree } from '../windows/splitTree';

/** The tree as text: `row(a,b)` for a split, the window id for a pane. */
function shape(tree: SplitTree | null): string {
  if (tree === null) {
    return 'empty';
  }
  return tree.type === 'pane' ? tree.windowId : `${tree.dir}(${shape(tree.a)},${shape(tree.b)})`;
}

/** The lines the buttons filled into the command line instead of running. */
const filled: string[] = [];

/** The lines the buttons ran, which never went near the command line. */
const ran: string[] = [];

/** Runs lines through the real split commands over the live state; collects the prefilled ones. */
function Runner(props: { readonly children: JSX.Element }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const registry = buildRegistry([vsplit, split, unsplit]);
  if (!registry.ok) {
    throw new Error(registry.error);
  }
  const runRef = useRef<PostActions['run']>(() => undefined);
  useEffect(() => {
    runRef.current = ({ line, prefill }) => {
      if (prefill) {
        filled.push(line);
        return;
      }
      ran.push(line);
      const context = fakeCommandContext({
        state,
        windows: state.windows,
        dispatch,
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
  return (
    <PostActionsProvider actions={actions}>
      {props.children}
      <output aria-label="shape">{shape(activeDesktop(state.layout).tree)}</output>
    </PostActionsProvider>
  );
}

/** The desktop of two panes, a and b, b focused, inside a running {@link Runner}. */
function renderDesk(): void {
  filled.length = 0;
  ran.length = 0;
  render(
    <AppStateProvider initial={twoPanes()}>
      <Runner>
        <DesktopView />
      </Runner>
    </AppStateProvider>,
  );
}

/** Opens the menu of the button called {@link name} on pane a (the first), and returns that menu. */
function openFirst(name: string): HTMLElement {
  const [button] = screen.getAllByRole('button', { name });
  if (button === undefined) {
    throw new Error(`no ${name} button`);
  }
  fireEvent.click(button);
  return screen.getByRole('menu', { name });
}

describe('the split buttons', () => {
  it('splits the clicked pane side by side, not the focused one', async () => {
    renderDesk();

    openFirst('Split side by side');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Same window' }));

    await waitFor(() => {
      expect(screen.getByLabelText('shape')).toHaveTextContent(
        'row(row(phantom:-:a,phantom:-:a),phantom:-:b)',
      );
    });
  });

  it('splits the clicked pane stacked from the other button', async () => {
    renderDesk();

    openFirst('Split stacked');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Same window' }));

    await waitFor(() => {
      expect(screen.getByLabelText('shape')).toHaveTextContent(
        'row(column(phantom:-:a,phantom:-:a),phantom:-:b)',
      );
    });
  });

  it('fills the command line, without running it, for Existing window…', async () => {
    renderDesk();

    openFirst('Split stacked');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Existing window…' }));

    await waitFor(() => {
      expect(filled).toStrictEqual(['/split win']);
    });

    expect(ran).toStrictEqual([]);
    expect(screen.getByLabelText('shape')).toHaveTextContent('row(phantom:-:a,phantom:-:b)');
  });

  it('asks for the tag in a dialog, then runs the finished line without prefilling', async () => {
    renderDesk();

    openFirst('Split side by side');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hashtag…' }));
    const input = screen.getByRole('combobox', { name: 'Split side by side' });

    fireEvent.change(input, { target: { value: '#rust' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(ran).toStrictEqual(['/vsplit tag rust']);
    });

    expect(filled).toStrictEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the tag dialog with its title, placeholder and focus in the field', () => {
    renderDesk();

    openFirst('Split side by side');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hashtag…' }));
    const input = screen.getByRole('combobox', { name: 'Split side by side' });

    expect(screen.getByRole('dialog', { name: 'Split with hashtag' })).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('placeholder', '#tag');
  });

  it('asks for a handle for the DM row and adds the @ the answer lacks', async () => {
    renderDesk();

    openFirst('Split stacked');
    fireEvent.click(screen.getByRole('menuitem', { name: 'DM…' }));
    const input = screen.getByRole('combobox', { name: 'Split stacked' });
    fireEvent.change(input, { target: { value: 'bob@wired2.test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(ran).toStrictEqual(['/split dm @bob@wired2.test']);
    });

    expect(filled).toStrictEqual([]);
  });

  it('runs nothing and gives focus back to the menu button when the dialog is cancelled', () => {
    renderDesk();

    openFirst('Split stacked');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Search…' }));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Split stacked' })[0]).toHaveFocus();
    expect(ran).toStrictEqual([]);
    expect(filled).toStrictEqual([]);
  });

  it('offers the views the registry has and leaves out the ones it lacks', () => {
    renderDesk();

    const menu = openFirst('Split side by side');
    const labels = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent);

    expect(labels).toContain('Home');
    expect(labels).toContain('Existing window…');
    expect(labels).toContain('People here');
    expect(labels).toContain('New feed…');
    expect(labels).not.toContain('Direct messages');
  });
});
