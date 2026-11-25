/**
 * Tests for the mute duration choices (WFE-267) as the mute dialog shows them:
 * seven radios with forever chosen and focused first, a click choosing one,
 * the arrow keys moving choice and focus with wrap-around, other keys doing
 * nothing, only the chosen radio being a tab stop, and Escape cancelling.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';
import { MuteDurations } from './MuteDurations';

/** The labels of the choices, in order. */
const LABELS = ['Forever', '30 minutes', '1 hour', '6 hours', '1 day', '3 days', '7 days'];

/** The mute dialog around a stateful group, with the cancel spy it was given. */
function Harness(props: { readonly onCancel: () => void }): JSX.Element {
  const [word, setWord] = useState('');
  return (
    <ConfirmDialog
      confirmLabel="Mute"
      message="For how long?"
      onCancel={props.onCancel}
      onConfirm={() => undefined}
      title="Mute @carol@misskey.test?"
    >
      <MuteDurations onChange={setWord} value={word} />
    </ConfirmDialog>
  );
}

/** Render the dialog and return the cancel spy. */
function renderDialog(): () => void {
  const onCancel = vi.fn<() => void>();
  render(<Harness onCancel={onCancel} />);
  return onCancel;
}

describe(MuteDurations, () => {
  it('offers every duration as a radio, with forever chosen and focused', () => {
    renderDialog();

    const radios = screen.getAllByRole('radio');

    expect(radios.map((radio) => radio.parentElement?.textContent)).toStrictEqual(LABELS);
    expect(screen.getByRole('radiogroup', { name: 'Mute for' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Forever' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Forever' })).toHaveFocus();
  });

  it('chooses a radio on click, making it the only tab stop', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('radio', { name: '1 day' }));

    expect(screen.getByRole('radio', { name: '1 day' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Forever' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '1 day' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Forever' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves the choice and focus with the down and right arrows', () => {
    renderDialog();

    fireEvent.keyDown(screen.getByRole('radio', { name: 'Forever' }), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('radio', { name: '30 minutes' }), { key: 'ArrowRight' });

    expect(screen.getByRole('radio', { name: '1 hour' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '1 hour' })).toHaveFocus();
  });

  it('moves the choice and focus with the up and left arrows, wrapping at the ends', () => {
    renderDialog();

    fireEvent.keyDown(screen.getByRole('radio', { name: 'Forever' }), { key: 'ArrowUp' });

    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '7 days' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('radio', { name: '7 days' }), { key: 'ArrowRight' });

    expect(screen.getByRole('radio', { name: 'Forever' })).toBeChecked();

    fireEvent.keyDown(screen.getByRole('radio', { name: 'Forever' }), { key: 'ArrowLeft' });

    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked();
  });

  it('leaves other keys alone', () => {
    renderDialog();

    fireEvent.keyDown(screen.getByRole('radio', { name: 'Forever' }), { key: 'a' });

    expect(screen.getByRole('radio', { name: 'Forever' })).toBeChecked();
  });

  it('cancels on Escape', () => {
    const onCancel = renderDialog();

    fireEvent.keyDown(screen.getByRole('radio', { name: 'Forever' }), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledExactlyOnceWith();
  });
});
