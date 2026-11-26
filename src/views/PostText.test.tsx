/**
 * Tests for the post text and its suggestion list (WFE-302): the textarea is
 * wired to the list (controls, autocomplete, the highlighted row) and stays a
 * plain textbox, the completion hears every key, edit, click and key release,
 * Enter sends exactly as it does without a list, the list is drawn above the
 * box unless there is no room above it, and a box without completion draws no
 * list.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type PostCompletion, PostText } from './PostText';

/** A completion over two rows, the second highlighted, whose handlers are spies. */
function completion(overrides: Partial<PostCompletion> = {}): PostCompletion {
  return {
    ref: { current: null },
    onKeyDown: vi.fn(),
    onCaret: vi.fn(),
    listId: 'post-list',
    rows: [
      { label: '@alice@m.example', description: 'Alice', pick: vi.fn() },
      { label: '@alex@m.example', description: 'Alex', pick: vi.fn() },
    ],
    active: 1,
    ...overrides,
  };
}

/** Render the text over {@link text} with a send spy, and give both back. */
function show(
  extra: Partial<Parameters<typeof PostText>[0]> = {},
  text = '@al',
): { send: () => void } {
  const send = vi.fn();
  render(<PostText compact={false} onText={vi.fn()} send={send} text={text} {...extra} />);
  return { send };
}

/** The post textarea. */
function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

describe(PostText, () => {
  it('ties the textarea to the list and the highlighted row, and stays a textbox', () => {
    show({ completion: completion() });

    expect(field()).toHaveAttribute('aria-controls', 'post-list');
    expect(field()).toHaveAttribute('aria-autocomplete', 'list');
    expect(field()).toHaveAttribute('aria-activedescendant', 'post-list-1');
    expect(screen.getByRole('listbox', { name: 'Post suggestions' })).toHaveAttribute(
      'id',
      'post-list',
    );
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('lists every row and scrolls the highlighted one into view (WFE-306)', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const many = Array.from({ length: 12 }, (_, index) => ({
      label: `@u${String(index)}`,
      description: '',
      pick: vi.fn(),
    }));

    show({ completion: completion({ rows: many, active: 10 }) });

    const options = screen.getAllByRole('option');

    expect(options).toHaveLength(12);
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
    expect(scrollIntoView.mock.contexts[0]).toBe(options[10]);

    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  it('names no row while none is highlighted', () => {
    show({ completion: completion({ active: -1 }) });

    expect(field()).not.toHaveAttribute('aria-activedescendant');
  });

  it('draws no list and wires nothing without a completion', () => {
    show();

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(field()).not.toHaveAttribute('aria-controls');
    expect(field()).not.toHaveAttribute('aria-autocomplete');
  });

  it('hands the completion every key, edit, click and key release', () => {
    const wired = completion();
    show({ completion: wired });

    fireEvent.keyDown(field(), { key: 'Tab' });
    fireEvent.change(field(), { target: { value: '@alx' } });
    fireEvent.click(field());
    fireEvent.keyUp(field(), { key: 'ArrowLeft' });

    expect(wired.onKeyDown).toHaveBeenCalledTimes(1);
    expect(wired.onCaret).toHaveBeenCalledTimes(3);
  });

  it('reports the text of an edit', () => {
    const onText = vi.fn();
    show({ onText, completion: completion() });

    fireEvent.change(field(), { target: { value: '@alx' } });

    expect(onText).toHaveBeenCalledWith('@alx');
  });

  it('sends on Ctrl+Enter with the list open, but not on a bare Enter', () => {
    const { send } = show({ completion: completion() });

    fireEvent.keyDown(field(), { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends a compact box on a bare Enter with the list open', () => {
    const { send } = show({ completion: completion(), compact: true });

    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('leaves a key the completion took to the completion', () => {
    const { send } = show({
      compact: true,
      completion: completion({
        onKeyDown: (event) => {
          event.preventDefault();
        },
      }),
    });

    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(send).not.toHaveBeenCalled();
  });
});

describe('the side of the list', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Make the list {@link height} tall and the box {@link top} pixels from the top of the screen. */
  function measured(top: number, height: number): void {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: top,
      top,
      left: 0,
      right: 100,
      bottom: top + 20,
      width: 100,
      height: 20,
      toJSON: () => ({}),
    });
  }

  /** The element that holds the list. */
  function popup(): HTMLElement {
    const element = screen.getByRole('listbox', { hidden: true }).parentElement;
    if (element === null) {
      throw new Error('the list has no popup');
    }
    return element;
  }

  it('draws the list above the box where there is room', () => {
    measured(300, 100);
    show({ completion: completion() });

    expect(popup()).toHaveAttribute('data-side', 'above');
  });

  it('draws the list below the box where there is no room above it', () => {
    measured(40, 100);
    show({ completion: completion() });

    expect(popup()).toHaveAttribute('data-side', 'below');
  });
});
