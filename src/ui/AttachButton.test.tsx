/**
 * Tests for the command line's attach button: it is named `Attach media` and
 * asks the app to open the file dialog when clicked.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AttachButton } from './AttachButton';

describe(AttachButton, () => {
  it('asks to attach when clicked', () => {
    const onAttach = vi.fn();
    render(<AttachButton onAttach={onAttach} />);

    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));

    expect(onAttach).toHaveBeenCalledTimes(1);
  });
});
