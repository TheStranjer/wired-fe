/**
 * Tests for the feed editor window of a new feed, and of one whose feed is
 * gone (decision 13 and 14): saving a new feed opens it in the editor's pane,
 * replacing the editor; the model's refusals are shown and the editor stays;
 * a window that is not in the list is a new editor; a missing feed is said so.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';
import { describe, expect, it } from 'vitest';

import { MAIN, editorSession, editorWindowId } from './editorSession';
import { FeedEditorWindow } from './FeedEditorWindow';
import type { AppState } from '../../state/appState';
import { renderWithLines } from '../../test/liveLines';
import { LineRunnerProvider } from '../../views/LineRunnerContext';
import { windowId } from '../../windows/model';

/** The editor window {@link id} over {@link state} with a live command line; returns the spy of the lines it ran. */
function renderEditor(state: AppState, id: string): Mock<(lines: readonly string[]) => void> {
  return renderWithLines(state, (run) => (
    <LineRunnerProvider runner={run}>
      <FeedEditorWindow windowId={id} />
    </LineRunnerProvider>
  ));
}

/** Type {@link name} into the name field. */
function typeName(name: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: 'Feed name' }), { target: { value: name } });
}

describe('the feed editor of a new feed', () => {
  it('saves it, opens it in the pane the editor was in and closes the editor', async () => {
    const spy = renderEditor(editorSession(null), editorWindowId(null));

    expect(screen.getByLabelText('desk')).toHaveTextContent('shown: feedEditor:-:new');
    expect(screen.queryByRole('button', { name: '[ delete feed ]' })).not.toBeInTheDocument();

    typeName('fresh');
    fireEvent.click(screen.getByRole('checkbox', { name: 'home of @lain@wired.example' }));

    fireEvent.click(screen.getByRole('button', { name: '[ save ]' }));

    await waitFor(() => {
      expect(screen.getByLabelText('desk')).toHaveTextContent(
        'feeds: main,quiet,fresh | windows: status,~fresh | shown: feed:-:f3',
      );
    });

    expect(spy).toHaveBeenCalledExactlyOnceWith([
      '/feed new fresh @lain@wired.example:home',
      '/feed open fresh',
    ]);
  });

  it('shows what the model refuses and stays an editor', async () => {
    renderEditor(editorSession(null), editorWindowId(null));
    typeName('main');

    fireEvent.click(screen.getByRole('button', { name: '[ save ]' }));

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('A feed named "main" already exists');
    expect(screen.getByLabelText('desk')).toHaveTextContent('windows: status,new feed');
  });

  it('is the editor of a new feed for a window that is not in the list', () => {
    renderEditor(editorSession(MAIN), 'ghost');

    expect(screen.getByRole('textbox', { name: 'Feed name' })).toHaveValue('');
  });
});

describe('the feed editor of a feed that is gone', () => {
  it('says the feed no longer exists', () => {
    const ref = { kind: 'feedEditor', accountKey: null, target: 'f9' } as const;
    const state = editorSession(MAIN, [
      { type: 'windows', action: { type: 'open', ref, title: 'edit' } },
    ]);

    renderEditor(state, windowId(ref));

    expect(screen.getByText('This feed no longer exists')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
