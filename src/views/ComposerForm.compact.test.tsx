/**
 * Tests for the compact composer form (WFE-207): it leaves out the content
 * warning and the audience, Enter sends and Shift+Enter does not, Enter in the
 * middle of an IME composition does not, Ctrl+Enter still sends, the text box
 * is fitted to its text as it changes, and its focus is reported.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ComposerForm, type ComposerFormProps } from './ComposerForm';

/** Renders the compact form over {@link text}, and gives back its send spy. */
function show(text: string, overrides: Partial<ComposerFormProps> = {}): () => void {
  const onSend = vi.fn();
  render(
    <ComposerForm
      allowLocal={false}
      compact
      error={null}
      fields={{ text, spoiler: '', visibility: 'direct' }}
      maxCharacters={500}
      onChange={vi.fn()}
      onSend={onSend}
      sending={false}
      {...overrides}
    />,
  );
  return onSend;
}

/** The post textarea. */
function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

describe('the compact composer form', () => {
  it('shows the text, the counter and send, but no warning or audience', () => {
    show('hi');

    expect(field()).toHaveValue('hi');
    expect(screen.getByText('2/500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[ send ]' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Content warning' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Visibility' })).toBeNull();
  });

  it('sends on Enter', () => {
    const onSend = show('hi');

    const sent = fireEvent.keyDown(field(), { key: 'Enter' });

    expect(sent).toBe(false);
    expect(onSend).toHaveBeenCalledExactlyOnceWith();
  });

  it('sends on Ctrl+Enter', () => {
    const onSend = show('hi');

    fireEvent.keyDown(field(), { key: 'Enter', ctrlKey: true });

    expect(onSend).toHaveBeenCalledExactlyOnceWith();
  });

  it('breaks the line on Shift+Enter instead of sending', () => {
    const onSend = show('hi');

    const untouched = fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true });

    expect(untouched).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send on the Enter that ends an IME composition', () => {
    const onSend = show('hi');

    fireEvent.keyDown(field(), { key: 'Enter', isComposing: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send on other keys', () => {
    const onSend = show('hi');

    fireEvent.keyDown(field(), { key: 'a' });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send an empty draft', () => {
    const onSend = show('  ');

    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('fits the text box to the text it holds', () => {
    vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(66);
    show('one\ntwo\nthree');

    expect(field().style.height).toBe('66px');
  });

  it('reports focus on the text box', () => {
    const onFocus = vi.fn();
    show('hi', { onFocus });

    fireEvent.focus(field());

    expect(onFocus).toHaveBeenCalledExactlyOnceWith(expect.anything());
  });

  it('leaves the height of the full form to its stylesheet', () => {
    show('hi', { compact: false });

    expect(field().style.height).toBe('');
  });
});
