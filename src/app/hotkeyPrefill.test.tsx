/**
 * Tests for the caret handoff behind a prefill binding: a request for text the
 * command line already shows places the caret at once; a request for text it
 * does not show yet waits for the commit that brings it and then places the
 * caret, once; and a request that never comes due, or finds no command line,
 * touches nothing. The text fill itself is covered through the hotkeys in
 * useHotkeys.prefill.test.tsx.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCaretToEnd } from './hotkeyPrefill';

/** A real input in the document, so focus and selection behave as in the app. */
function attachedInput(value: string): HTMLInputElement {
  const input = document.createElement('input');
  input.value = value;
  document.body.append(input);
  return input;
}

/** The hook over a ref holding {@link input}, and the ref to move it by. */
function mountOver(input: HTMLInputElement | null): {
  readonly ref: { current: HTMLInputElement | null };
  readonly request: (text: string) => void;
  readonly rerender: () => void;
} {
  const ref: { current: HTMLInputElement | null } = { current: input };
  const view = renderHook(() => useCaretToEnd(ref));
  return {
    ref,
    request: (text) => {
      view.result.current(text);
    },
    rerender: view.rerender,
  };
}

describe(useCaretToEnd, () => {
  it('places the caret at once when the line already shows the text', () => {
    const input = attachedInput('/reply a0 ');
    const { request } = mountOver(input);

    request('/reply a0 ');

    expect(input).toHaveFocus();
    expect([input.selectionStart, input.selectionEnd]).toStrictEqual([10, 10]);
  });

  it('waits for the commit that brings the text, then places the caret once', () => {
    const input = attachedInput('');
    const { request, rerender } = mountOver(input);

    request('/fav ');

    expect(input).not.toHaveFocus();

    input.value = '/fav ';
    rerender();

    expect(input).toHaveFocus();
    expect([input.selectionStart, input.selectionEnd]).toStrictEqual([5, 5]);

    input.setSelectionRange(0, 0);
    rerender();

    expect(input.selectionStart).toBe(0);
  });

  it('does nothing while the line still shows other text', () => {
    const input = attachedInput('typed');
    const { request, rerender } = mountOver(input);

    request('/fav ');
    rerender();

    expect(input).not.toHaveFocus();
  });

  it('does nothing without a command line to place the caret in', () => {
    const { request, rerender } = mountOver(null);
    const focused = document.activeElement;

    request('/fav ');
    rerender();

    expect(document.activeElement).toBe(focused);
  });
});
