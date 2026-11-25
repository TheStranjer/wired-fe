/**
 * Tests for the feed editor window of a saved feed over a live command line
 * (decision 6, 13 and 14): checkbox, name and tag edits are saved as the
 * `/feed` lines the command line would run and the app's state follows;
 * refusals of the model and of the name are shown inline; a delete asks first.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';
import { describe, expect, it } from 'vitest';

import { MAIN, QUIET, editorSession, editorWindowId } from './editorSession';
import { FeedEditorWindow } from './FeedEditorWindow';
import type { FeedSpec } from '../../state/feeds';
import { renderWithLines } from '../../test/liveLines';
import { LineRunnerProvider } from '../../views/LineRunnerContext';

/** The editor of {@link feed} over a live command line; returns the spy of the lines it ran. */
function renderEditor(feed: FeedSpec): Mock<(lines: readonly string[]) => void> {
  return renderWithLines(editorSession(feed), (run) => (
    <LineRunnerProvider runner={run}>
      <FeedEditorWindow windowId={editorWindowId(feed)} />
    </LineRunnerProvider>
  ));
}

/** The checkbox named {@link name}. */
function box(name: string): HTMLElement {
  return screen.getByRole('checkbox', { name });
}

/** Type {@link name} into the name field. */
function typeName(name: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: 'Feed name' }), { target: { value: name } });
}

/** Click `[ save ]`. */
function save(): void {
  fireEvent.click(screen.getByRole('button', { name: '[ save ]' }));
}

describe('the feed editor of a saved feed', () => {
  it('shows the feed with its name, ticks and tags, and nothing to save', () => {
    renderEditor(MAIN);

    expect(screen.getByRole('textbox', { name: 'Feed name' })).toHaveValue('main');
    expect(box('home of @lain@wired.example')).toBeChecked();
    expect(box('home of @alice@wired.example')).not.toBeChecked();
    expect(screen.getByRole('list', { name: 'Tags of @alice@wired.example' })).toHaveTextContent(
      '#rust',
    );
    expect(screen.getByRole('button', { name: '[ save ]' })).toBeDisabled();
  });

  it('saves what was unticked, ticked and renamed as /feed lines, and the feed follows', async () => {
    const spy = renderEditor(MAIN);
    typeName('prime');
    fireEvent.click(box('home of @lain@wired.example'));
    fireEvent.click(box('mentions of @alice@wired.example'));

    save();

    const saved = await screen.findByText('Saved');

    expect(saved).toBeInTheDocument();
    expect(spy).toHaveBeenCalledExactlyOnceWith([
      '/feed rm main @lain@wired.example:home',
      '/feed add main @alice@wired.example:mentions',
      '/feed rename main prime',
    ]);
    expect(screen.getByLabelText('desk')).toHaveTextContent('feeds: prime,quiet');
    expect(screen.getByLabelText('desk')).toHaveTextContent('windows: status,edit ~prime');
    expect(screen.getByRole('button', { name: '[ save ]' })).toBeDisabled();
  });

  it('saves a tag added in the editor, and stops saying Saved when edited again', async () => {
    const spy = renderEditor(QUIET);
    const tagBox = screen.getByRole('textbox', { name: 'add tag for @lain@wired.example' });
    fireEvent.change(tagBox, { target: { value: '#lisp' } });
    fireEvent.keyDown(tagBox, { key: 'Enter' });

    save();

    const saved = await screen.findByText('Saved');

    expect(saved).toBeInTheDocument();
    expect(spy).toHaveBeenCalledExactlyOnceWith(['/feed add quiet @lain@wired.example:tag:lisp']);

    fireEvent.click(box('home of @lain@wired.example'));

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('shows what the model refuses inline, keeping the edits', async () => {
    renderEditor(MAIN);
    typeName('QUIET');

    save();

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('A feed named "quiet" already exists');
    expect(screen.getByRole('textbox', { name: 'Feed name' })).toHaveValue('QUIET');
    expect(screen.getByLabelText('desk')).toHaveTextContent('feeds: main,quiet');
    expect(screen.getByRole('button', { name: '[ save ]' })).toBeEnabled();
  });

  it('shows a name the command refuses as the refusal says', async () => {
    renderEditor(MAIN);
    typeName('list');

    save();

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('"list" is a /feed word; pick another name');
  });

  it('refuses an empty name and a name with spaces before running anything', () => {
    const spy = renderEditor(MAIN);

    typeName('  ');
    save();

    expect(screen.getByRole('alert')).toHaveTextContent('A feed name is 1-32 characters');

    typeName('my feed');
    save();

    expect(screen.getByRole('alert')).toHaveTextContent('A feed name has no spaces');
    expect(spy).not.toHaveBeenCalled();
  });

  it('asks before it deletes, then deletes the feed and closes its editor', async () => {
    const spy = renderEditor(MAIN);

    fireEvent.click(screen.getByRole('button', { name: '[ delete feed ]' }));

    expect(spy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '[ yes, delete ]' }));

    await waitFor(() => {
      expect(screen.getByLabelText('desk')).toHaveTextContent('feeds: quiet | windows: status |');
    });

    expect(spy).toHaveBeenCalledExactlyOnceWith(['/feed delete main']);
  });
});
