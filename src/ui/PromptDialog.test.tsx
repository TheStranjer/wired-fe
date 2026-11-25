/**
 * Tests for the one-line prompt (WFE-269): focus is in the input as it opens,
 * Enter and `OK` submit the typed value, Escape and `Cancel` dismiss and hand
 * focus back to what held it, `OK` is disabled while the value is blank, and
 * the suggestions are a combobox listbox the arrows move through, Enter and a
 * click accept, and typing shows again.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PromptDialog } from './PromptDialog';

const WORDS = ['@alice@a.test', '@alma@b.test', '@bob@a.test'] as const;

/** The input of the open dialog. */
function field(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Pop out' });
}

/** Opens the dialog over an `outside` button, which holds focus first. */
function Host(props: {
  readonly onSubmit: (value: string) => void;
  readonly suggestions?: readonly string[] | undefined;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const close = (): void => {
    setOpen(false);
  };
  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
        type="button"
      >
        outside
      </button>
      {open ? (
        <PromptDialog
          field="Pop out"
          onCancel={close}
          onSubmit={(value) => {
            close();
            props.onSubmit(value);
          }}
          placeholder="@user@instance"
          suggestions={props.suggestions}
          title="Open profile"
        />
      ) : null}
    </>
  );
}

/** Renders {@link Host}, focuses its button and opens the dialog. */
function renderOpen(onSubmit: (value: string) => void, suggestions?: readonly string[]): void {
  render(<Host onSubmit={onSubmit} suggestions={suggestions} />);
  const outside = screen.getByRole('button', { name: 'outside' });
  outside.focus();
  fireEvent.click(outside);
}

describe(PromptDialog, () => {
  it('is a named dialog with the field focused and hinting at its answer', () => {
    renderOpen(vi.fn());

    expect(screen.getByRole('dialog', { name: 'Open profile' })).toBeInTheDocument();
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute('placeholder', '@user@instance');
  });

  it('submits the typed value on Enter', () => {
    const onSubmit = vi.fn();
    renderOpen(onSubmit);

    fireEvent.change(field(), { target: { value: '@bob@a.test' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('@bob@a.test');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submits on OK', () => {
    const onSubmit = vi.fn();
    renderOpen(onSubmit);

    fireEvent.change(field(), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('rust');
  });

  it('disables OK and ignores Enter while the value is blank', () => {
    const onSubmit = vi.fn();
    renderOpen(onSubmit);

    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();

    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cancels on Escape and returns focus to the button that held it', () => {
    const onSubmit = vi.fn();
    renderOpen(onSubmit);

    fireEvent.keyDown(field(), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'outside' })).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cancels on Cancel', () => {
    const onSubmit = vi.fn();
    renderOpen(onSubmit);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('the suggestions', () => {
  it('lists none, and the combobox says so, without any', () => {
    renderOpen(vi.fn());

    expect(field()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();

    fireEvent.keyDown(field(), { key: 'ArrowDown' });

    expect(field()).not.toHaveAttribute('aria-activedescendant');
  });

  it('shows them as options under the field', () => {
    renderOpen(vi.fn(), WORDS);

    expect(field()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toStrictEqual(WORDS);
  });

  it('moves with the arrows, wrapping, and names the option in focus', () => {
    renderOpen(vi.fn(), WORDS);

    fireEvent.keyDown(field(), { key: 'ArrowUp' });

    expect(screen.getByRole('option', { name: '@bob@a.test', selected: true })).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[2]?.id);

    fireEvent.keyDown(field(), { key: 'ArrowDown' });

    expect(
      screen.getByRole('option', { name: '@alice@a.test', selected: true }),
    ).toBeInTheDocument();

    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'ArrowUp' });

    expect(
      screen.getByRole('option', { name: '@alice@a.test', selected: true }),
    ).toBeInTheDocument();
  });

  it('puts the option in focus into the field on Enter, hides the list and does not submit', () => {
    const onSubmit = vi.fn();
    renderOpen(onSubmit, WORDS);

    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(field()).toHaveValue('@alma@b.test');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('@alma@b.test');
  });

  it('takes a clicked option and keeps focus in the field', () => {
    renderOpen(vi.fn(), WORDS);

    fireEvent.click(screen.getByRole('option', { name: '@bob@a.test' }));

    expect(field()).toHaveValue('@bob@a.test');
    expect(field()).toHaveFocus();
  });

  it('shows the list again after the next edit and tells the caller', () => {
    const onChange = vi.fn();
    render(
      <PromptDialog
        field="Pop out"
        onCancel={vi.fn()}
        onChange={onChange}
        onSubmit={vi.fn()}
        placeholder="@user@instance"
        suggestions={WORDS}
        title="Open profile"
      />,
    );

    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(screen.queryByRole('option')).not.toBeInTheDocument();

    fireEvent.change(field(), { target: { value: '@al' } });

    expect(screen.getAllByRole('option')).toHaveLength(WORDS.length);
    expect(onChange).toHaveBeenLastCalledWith('@al');
  });

  it('shows the list again on an arrow after Enter hid it', () => {
    renderOpen(vi.fn(), WORDS);

    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'Enter' });
    fireEvent.keyDown(field(), { key: 'ArrowDown' });

    expect(screen.getAllByRole('option')).toHaveLength(WORDS.length);
  });

  it('leaves other keys alone', () => {
    renderOpen(vi.fn(), WORDS);

    fireEvent.keyDown(field(), { key: 'a' });

    expect(screen.getAllByRole('option')).toHaveLength(WORDS.length);
    expect(field()).not.toHaveAttribute('aria-activedescendant');
  });
});
