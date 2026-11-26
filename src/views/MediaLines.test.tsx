/**
 * Tests for the attachment lines of a box (WFE-205, WFE-289): the roomy
 * variant offers `[ 📎 attach ]`, the compact one `[📎]`, both under the same
 * accessible name; the lines show only once a file is held; the picked files
 * are reported and the input is emptied for the next pick.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MediaLines } from './MediaLines';
import { uploadingMedia } from '../state/composerMedia';

/** The lines over {@link names}, compact or not; the spy gets the picked files. */
function show(names: readonly string[], compact: boolean): () => void {
  const onFiles = vi.fn();
  render(
    <MediaLines
      compact={compact}
      items={names.map((name) => uploadingMedia(name, name))}
      onDescribe={vi.fn()}
      onFiles={onFiles}
      onRemove={vi.fn()}
    />,
  );
  return onFiles;
}

describe(MediaLines, () => {
  it('offers the long attach button in the roomy variant', () => {
    show([], false);

    expect(screen.getByRole('button', { name: 'Attach media' })).toHaveTextContent('[ 📎 attach ]');
    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });

  it('offers the short attach button and no list in the compact variant', () => {
    show([], true);

    expect(screen.getByRole('button', { name: 'Attach media' })).toHaveTextContent('[📎]');
    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });

  it('lists the held files in the compact variant', () => {
    show(['cat.png'], true);

    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('cat.png');
  });

  it('reports the picked files', () => {
    const onFiles = show([], true);
    const file = new File(['pixels'], 'cat.png', { type: 'image/png' });
    const input = screen.getByLabelText<HTMLInputElement>('Media files');

    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    expect(onFiles).toHaveBeenCalledWith([file]);
  });
});
