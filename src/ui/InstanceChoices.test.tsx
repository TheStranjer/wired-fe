/**
 * Tests for the instance picker (WFE-307): one radio per listed instance,
 * named by its host, the free-text field only where custom instances are
 * allowed, and what each reports.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InstanceChoices } from './InstanceChoices';

const ORIGINS = ['https://wired.example', 'http://localhost:3000'];

describe(InstanceChoices, () => {
  it('offers each instance as a radio named by its host inside a named group', () => {
    render(<InstanceChoices allowCustom={false} onChange={vi.fn()} origins={ORIGINS} value="" />);

    expect(screen.getByRole('group', { name: 'Instance' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'wired.example' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'http://localhost:3000' })).not.toBeChecked();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('reports the origin of the chosen instance and shows it checked', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <InstanceChoices allowCustom={false} onChange={onChange} origins={ORIGINS} value="" />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'wired.example' }));
    rerender(
      <InstanceChoices
        allowCustom={false}
        onChange={onChange}
        origins={ORIGINS}
        value="https://wired.example"
      />,
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith('https://wired.example');
    expect(screen.getByRole('radio', { name: 'wired.example' })).toBeChecked();
  });

  it('adds a free-text field when custom instances are allowed, and reports what is typed', () => {
    const onChange = vi.fn();
    render(<InstanceChoices allowCustom onChange={onChange} origins={ORIGINS} value="" />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Other instance' }), {
      target: { value: 'other.example' },
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('other.example');
  });

  it('clears the typed text when a listed instance is chosen after it', () => {
    render(<InstanceChoices allowCustom onChange={vi.fn()} origins={ORIGINS} value="" />);
    const field = screen.getByRole('textbox', { name: 'Other instance' });
    fireEvent.change(field, { target: { value: 'other.example' } });

    fireEvent.click(screen.getByRole('radio', { name: 'wired.example' }));

    expect(field).toHaveValue('');
  });
});
