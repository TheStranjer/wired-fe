/**
 * Tests for the hidden file input: a chosen list is handed on and the input
 * emptied so the same file can be chosen again, and an input that reports no
 * list hands on an empty one.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FilePicker } from './FilePicker';

/** Render the picker with a recording callback and return both it and the input. */
function mount(): {
  readonly input: HTMLInputElement;
  readonly onFiles: (files: readonly File[]) => void;
} {
  const onFiles = vi.fn<(files: readonly File[]) => void>();
  const { container } = render(<FilePicker inputRef={null} onFiles={onFiles} />);
  const input = container.querySelector('input');
  if (input === null) {
    throw new Error('the picker rendered no input');
  }
  return { input, onFiles };
}

describe(FilePicker, () => {
  it('hands on the chosen files', () => {
    const { input, onFiles } = mount();
    const file = new File(['pixel'], 'pixel.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    fireEvent.change(input);

    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('hands on an empty list when the input reports none', () => {
    const { input, onFiles } = mount();
    Object.defineProperty(input, 'files', { value: null, configurable: true });

    fireEvent.change(input);

    expect(onFiles).toHaveBeenCalledWith([]);
  });
});
