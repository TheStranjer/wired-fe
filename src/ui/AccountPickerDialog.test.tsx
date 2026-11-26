/**
 * Tests for the account picker dialog (WFE-282): a labelled modal dialog with
 * a radio per account and per scope, the starting choices checked, the digits
 * 1-9 choosing accounts, Enter and OK submitting the chosen key and scope,
 * Cancel and Escape cancelling, and focus landing on the chosen account.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AccountPickerDialog, type AccountPickerDialogProps } from './AccountPickerDialog';

const ACCOUNTS = [
  { key: 'k1', label: '@a@x' },
  { key: 'k2', label: '@b@x' },
  { key: 'k3', label: '@c@x' },
];

const SCOPES = [
  { value: 'feed', label: 'For this feed (~main)' },
  { value: 'global', label: 'Everywhere' },
];

/** Render the dialog with recording callbacks, over `overrides`. */
function renderDialog(overrides: Partial<AccountPickerDialogProps> = {}): {
  readonly onSubmit: (key: string, scope: string) => void;
  readonly onCancel: () => void;
} {
  const onSubmit = vi.fn<(key: string, scope: string) => void>();
  const onCancel = vi.fn<() => void>();
  render(
    <AccountPickerDialog
      accounts={ACCOUNTS}
      description="~main posts as @a@x (feed default)"
      onCancel={onCancel}
      onSubmit={onSubmit}
      scope="feed"
      scopes={SCOPES}
      selected="k2"
      title="Post as"
      {...overrides}
    />,
  );
  return { onSubmit, onCancel };
}

/** The form to submit, as Enter on a radio does in a browser. */
function submitForm(): void {
  const form = screen.getByRole('dialog', { name: 'Post as' }).querySelector('form');
  if (form === null) {
    throw new Error('no form');
  }
  fireEvent.submit(form);
}

describe(AccountPickerDialog, () => {
  it('is a dialog named by its title, described by the current state', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Post as' })).toHaveAccessibleDescription(
      '~main posts as @a@x (feed default)',
    );
    expect(screen.getByRole('heading', { name: 'Post as' })).toBeInTheDocument();
  });

  it('lists a numbered radio per account and a radio per scope, in labelled groups', () => {
    renderDialog();

    const accounts = screen.getByRole('group', { name: 'Accounts' });
    const remember = screen.getByRole('group', { name: 'Remember' });

    expect(accounts.querySelectorAll('input[type="radio"]')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: '1. @a@x' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3. @c@x' })).toBeInTheDocument();
    expect(remember.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Everywhere' })).toBeInTheDocument();
  });

  it('checks the given account and scope', () => {
    renderDialog();

    expect(screen.getByRole('radio', { name: '2. @b@x' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'For this feed (~main)' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '1. @a@x' })).not.toBeChecked();
  });

  it('puts focus on the chosen account', () => {
    renderDialog();

    expect(screen.getByRole('radio', { name: '2. @b@x' })).toHaveFocus();
  });

  it('chooses the nth account with a digit and moves focus to it', () => {
    renderDialog();

    fireEvent.keyDown(screen.getByRole('radio', { name: '2. @b@x' }), { key: '3' });

    expect(screen.getByRole('radio', { name: '3. @c@x' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '3. @c@x' })).toHaveFocus();
  });

  it('chooses with a digit from a button too', () => {
    renderDialog();

    fireEvent.keyDown(screen.getByRole('button', { name: 'OK' }), { key: '1' });

    expect(screen.getByRole('radio', { name: '1. @a@x' })).toBeChecked();
  });

  it.each([
    ['a digit past the last account', {}, '9'],
    ['zero', {}, '0'],
    ['a letter', {}, 'a'],
    ['a digit held with Ctrl', { ctrlKey: true }, '1'],
    ['a digit held with Alt', { altKey: true }, '1'],
    ['a digit held with Meta', { metaKey: true }, '1'],
  ])('leaves the choice alone for %s', (_name, modifiers, key) => {
    renderDialog();

    fireEvent.keyDown(screen.getByRole('radio', { name: '2. @b@x' }), { key, ...modifiers });

    expect(screen.getByRole('radio', { name: '2. @b@x' })).toBeChecked();
  });

  it('submits the starting choices on Enter', () => {
    const { onSubmit } = renderDialog();

    submitForm();

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('k2', 'feed');
  });

  it('submits the account and scope chosen since', () => {
    const { onSubmit } = renderDialog();

    fireEvent.keyDown(screen.getByRole('radio', { name: '2. @b@x' }), { key: '1' });
    fireEvent.click(screen.getByRole('radio', { name: 'Everywhere' }));
    submitForm();

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('k1', 'global');
  });

  it('submits from the OK button', () => {
    const { onSubmit } = renderDialog({
      scopes: [{ value: 'global', label: 'Everywhere' }],
      scope: 'global',
    });

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onSubmit).toHaveBeenCalledWith('k2', 'global');
  });

  it('orders Cancel before OK', () => {
    renderDialog();

    const names = screen.getAllByRole('button').map((button) => button.textContent);

    expect(names).toStrictEqual(['Cancel', 'OK']);
  });

  it('cancels from the Cancel button and on Escape, submitting nothing', () => {
    const { onCancel, onSubmit } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(screen.getByRole('radio', { name: '2. @b@x' }), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
