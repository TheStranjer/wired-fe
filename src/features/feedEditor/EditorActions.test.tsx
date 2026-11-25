/**
 * Tests for the feed editor's buttons (decision 14): `[ save ]` that is off
 * while nothing changed or lines run, `[ delete feed ]` that asks inline before
 * it deletes and can be cancelled, and the refusal or the "Saved" beside them.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditorActions } from './EditorActions';
import type { EditorSave } from './useEditorSave';

/** The state of an editor of a saved feed that has changes to save. */
const READY: EditorSave = {
  error: null,
  busy: false,
  saved: false,
  dirty: true,
  save: vi.fn(),
  remove: vi.fn(),
};

describe(EditorActions, () => {
  it('saves when [ save ] is clicked', () => {
    const save = vi.fn();
    render(<EditorActions save={{ ...READY, save }} />);

    fireEvent.click(screen.getByRole('button', { name: '[ save ]' }));

    expect(save).toHaveBeenCalledExactlyOnceWith(expect.anything());
  });

  it('turns [ save ] off while nothing changed and while lines run', () => {
    const view = render(<EditorActions save={{ ...READY, dirty: false }} />);

    expect(screen.getByRole('button', { name: '[ save ]' })).toBeDisabled();

    view.rerender(<EditorActions save={{ ...READY, busy: true }} />);

    expect(screen.getByRole('button', { name: '[ save ]' })).toBeDisabled();
  });

  it('asks before deleting, and deletes only when the question is answered yes', () => {
    const remove = vi.fn();
    render(<EditorActions save={{ ...READY, remove }} />);

    fireEvent.click(screen.getByRole('button', { name: '[ delete feed ]' }));

    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Confirm delete feed' })).toHaveTextContent(
      'Delete this feed?',
    );

    fireEvent.click(screen.getByRole('button', { name: '[ yes, delete ]' }));

    expect(remove).toHaveBeenCalledExactlyOnceWith(expect.anything());
  });

  it('goes back to [ delete feed ] when the question is cancelled', () => {
    const remove = vi.fn();
    render(<EditorActions save={{ ...READY, remove }} />);
    fireEvent.click(screen.getByRole('button', { name: '[ delete feed ]' }));

    fireEvent.click(screen.getByRole('button', { name: '[ cancel ]' }));

    expect(remove).not.toHaveBeenCalled();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[ delete feed ]' })).toBeInTheDocument();
  });

  it('turns the yes of the question off while lines run', () => {
    render(<EditorActions save={{ ...READY, busy: true }} />);
    fireEvent.click(screen.getByRole('button', { name: '[ delete feed ]' }));

    expect(screen.getByRole('button', { name: '[ yes, delete ]' })).toBeDisabled();
  });

  it('has no delete button for a feed that is not made yet', () => {
    render(<EditorActions save={{ ...READY, remove: null }} />);

    expect(screen.queryByRole('button', { name: '[ delete feed ]' })).not.toBeInTheDocument();
  });

  it('says what was refused and that a save went through', () => {
    const view = render(<EditorActions save={{ ...READY, error: 'No feed named "x"' }} />);

    expect(screen.getByRole('alert')).toHaveTextContent('No feed named "x"');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    view.rerender(<EditorActions save={{ ...READY, saved: true }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
