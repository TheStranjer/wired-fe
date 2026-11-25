/**
 * Tests for the error alert (WFE-271): an alertdialog named Error that
 * announces its message, focuses OK as it opens, dismisses on a click, Enter,
 * Space and Escape, never on a repeating keydown, and shows the repeat count
 * only above one.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorAlert } from './ErrorAlert';

/** Render an alert for {@link text} seen {@link count} times; the dismiss spy comes back. */
function open(text = 'Unknown command: /nope. Try /help', count = 1): () => void {
  const onDismiss = vi.fn();
  render(<ErrorAlert count={count} onDismiss={onDismiss} text={text} />);
  return onDismiss;
}

/** The OK button. */
function ok(): HTMLElement {
  return screen.getByRole('button', { name: 'OK' });
}

describe(ErrorAlert, () => {
  it('is an alertdialog named Error that announces the message', () => {
    open('Unknown view: omni');

    const dialog = screen.getByRole('alertdialog', { name: 'Error' });

    expect(dialog).toHaveAccessibleDescription('Unknown view: omni');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has one button, OK, and focuses it', () => {
    open();

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(ok()).toHaveFocus();
  });

  it('dismisses on a click on OK', () => {
    const onDismiss = open();

    fireEvent.click(ok());

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it.each([['Enter'], [' ']])('dismisses once on a %j keydown and keeps the default off', (key) => {
    const onDismiss = open();

    const notPrevented = fireEvent.keyDown(ok(), { key });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it('dismisses on Escape', () => {
    const onDismiss = open();

    fireEvent.keyDown(ok(), { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss on a repeating keydown', () => {
    const onDismiss = open();

    const notPrevented = fireEvent.keyDown(ok(), { key: 'Enter', repeat: true });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(notPrevented).toBe(false);
  });

  it('leaves other keys alone', () => {
    const onDismiss = open();

    const down = fireEvent.keyDown(ok(), { key: 'a' });
    const up = fireEvent.keyUp(ok(), { key: 'a' });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(down).toBe(true);
    expect(up).toBe(true);
  });

  it('keeps the browser from pressing OK a second time on keyup', () => {
    const onDismiss = open();

    const notPrevented = fireEvent.keyUp(ok(), { key: ' ' });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(notPrevented).toBe(false);
  });

  it('shows no count for a single error', () => {
    open();

    expect(screen.queryByText(/×/u)).toBeNull();
  });

  it('shows the count for a repeated error, outside the description', () => {
    open('boom', 3);

    expect(screen.getByText('(×3)')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog', { name: 'Error' })).toHaveAccessibleDescription('boom');
  });
});
