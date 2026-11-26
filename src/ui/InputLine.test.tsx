/**
 * Tests for the command line component: prompt, controlled typing, Enter, the
 * onKeyDown hook that runs before Enter handling, and focus.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { InputLine } from './InputLine';

const NOOP = (): undefined => undefined;

/** Renders the command line and returns its input element. */
function renderInputLine(
  value: string,
  onChange: (value: string) => void,
  onSubmit: (value: string) => void,
): HTMLElement {
  render(<InputLine prompt="lain>" value={value} onChange={onChange} onSubmit={onSubmit} />);
  return screen.getByRole('combobox', { name: 'Command line' });
}

describe(InputLine, () => {
  it('shows the prompt and a command line input', () => {
    renderInputLine('', NOOP, NOOP);

    expect(screen.getByText('lain>')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Command line' })).toHaveValue('');
  });

  it('shows its lead before the prompt', () => {
    render(
      <InputLine
        prompt="lain>"
        value=""
        onChange={NOOP}
        onSubmit={NOOP}
        lead={<button type="button">lead</button>}
      />,
    );

    const lead = screen.getByRole('button', { name: 'lead' });

    expect(lead.compareDocumentPosition(screen.getByText('lain>'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('hides the prompt from the accessibility tree', () => {
    renderInputLine('', NOOP, NOOP);

    expect(screen.getByText('lain>')).toHaveAttribute('aria-hidden', 'true');
  });

  it('calls onChange with the typed text', () => {
    const onChange = vi.fn<(value: string) => void>();
    const input = renderInputLine('', onChange, NOOP);

    fireEvent.change(input, { target: { value: '/follow @lain@wired.example' } });

    expect(onChange).toHaveBeenCalledWith('/follow @lain@wired.example');
  });

  it('submits the value on Enter', () => {
    const onSubmit = vi.fn<(value: string) => void>();
    const input = renderInputLine('hello wired', NOOP, onSubmit);

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('hello wired');
  });

  it('does not submit when the value is only spaces', () => {
    const onSubmit = vi.fn<(value: string) => void>();
    const input = renderInputLine('   ', NOOP, onSubmit);

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a blank line on Enter when allowEmpty is set', () => {
    const onSubmit = vi.fn<(value: string) => void>();
    render(<InputLine prompt=">" value="" onChange={NOOP} onSubmit={onSubmit} allowEmpty />);

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Command line' }), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('');
  });

  it('does not submit a blank line when allowEmpty is false', () => {
    const onSubmit = vi.fn<(value: string) => void>();
    render(
      <InputLine prompt=">" value="" onChange={NOOP} onSubmit={onSubmit} allowEmpty={false} />,
    );

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Command line' }), { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit on other keys', () => {
    const onSubmit = vi.fn<(value: string) => void>();
    const input = renderInputLine('hello wired', NOOP, onSubmit);

    fireEvent.keyDown(input, { key: 'a' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('forwards inputRef to the input', () => {
    const inputRef = createRef<HTMLInputElement>();
    render(<InputLine prompt=">" value="" onChange={NOOP} onSubmit={NOOP} inputRef={inputRef} />);

    expect(inputRef.current).toBe(screen.getByRole('combobox', { name: 'Command line' }));
  });

  it('calls onKeyDown with every key, before its own Enter handling', () => {
    const seen: string[] = [];
    const onSubmit = vi.fn<(value: string) => void>();
    render(
      <InputLine
        prompt=">"
        value="hello wired"
        onChange={NOOP}
        onSubmit={onSubmit}
        onKeyDown={(event) => {
          seen.push(event.key);
        }}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Command line' });

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(seen).toStrictEqual(['ArrowUp', 'Enter']);
    expect(onSubmit).toHaveBeenCalledWith('hello wired');
  });

  it('submits nothing when onKeyDown prevents Enter', () => {
    const onSubmit = vi.fn<(value: string) => void>();
    render(
      <InputLine
        prompt=">"
        value="hello wired"
        onChange={NOOP}
        onSubmit={onSubmit}
        onKeyDown={(event) => {
          event.preventDefault();
        }}
      />,
    );

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Command line' }), { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onFocus when the command line gains focus', () => {
    let focusCount = 0;
    const onFocus = (): void => {
      focusCount += 1;
    };
    render(<InputLine prompt=">" value="" onChange={NOOP} onSubmit={NOOP} onFocus={onFocus} />);

    fireEvent.focus(screen.getByRole('combobox', { name: 'Command line' }));

    expect(focusCount).toBe(1);
  });
});
