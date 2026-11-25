/**
 * useGlobalKeys: the one capture-phase keydown listener on window, its chord
 * conversion, and its lifetime.
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { InputMode } from './mode';
import { useGlobalKeys, usePendingKeys } from './useGlobalKeys';
import type { ChordHandler } from './useGlobalKeys';

/** Props of the test component {@link Probe}. */
type ProbeProps = {
  readonly handler: ChordHandler;
};

/** A component that mounts the hook under test and nothing else. */
function Probe({ handler }: ProbeProps): JSX.Element {
  useGlobalKeys(handler);
  return <p>keys probe</p>;
}

/** A handler that records the chords and events it receives. */
function recorder(
  result: boolean,
): ChordHandler & { seen: { chord: string; event: KeyboardEvent }[] } {
  const seen: { chord: string; event: KeyboardEvent }[] = [];
  return Object.assign(
    vi.fn((chord: string, event: KeyboardEvent): boolean => {
      seen.push({ chord, event });
      return result;
    }),
    { seen },
  );
}

describe(useGlobalKeys, () => {
  it('hands the handler Ctrl+e and prevents the default of a handled chord', () => {
    const handler = recorder(true);
    render(<Probe handler={handler} />);

    fireEvent.keyDown(window, { key: 'E', ctrlKey: true });

    expect(handler.seen[0]?.chord).toBe('Ctrl+e');
    expect(handler.seen[0]?.event.defaultPrevented).toBe(true);
  });

  it('leaves an unhandled chord unprevented', () => {
    const handler = recorder(false);
    render(<Probe handler={handler} />);

    fireEvent.keyDown(window, { key: 'j' });

    expect(handler.seen[0]?.chord).toBe('j');
    expect(handler.seen[0]?.event.defaultPrevented).toBe(false);
  });

  it('does not call the handler for a bare Shift press', () => {
    const handler = recorder(true);
    render(<Probe handler={handler} />);

    fireEvent.keyDown(window, { key: 'Shift' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not call the handler for a composing event', () => {
    const handler = recorder(true);
    render(<Probe handler={handler} />);

    // jsdom's KeyboardEvent has no isComposing, so the flag is defined by hand.
    const event = new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'isComposing', { value: true });
    fireEvent(window, event);

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not call the handler for a key pressed inside an open menu', () => {
    const handler = recorder(true);
    render(
      <>
        <Probe handler={handler} />
        <div role="menu">
          <button role="menuitem" type="button">
            item
          </button>
        </div>
      </>,
    );

    fireEvent.keyDown(screen.getByRole('menuitem'), { key: 'j' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps resize keys pressed on a pane divider from the handler', () => {
    const handler = recorder(true);
    render(
      <>
        <Probe handler={handler} />
        <div aria-label="Resize panes" role="separator" />
      </>,
    );
    const divider = screen.getByRole('separator');

    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    fireEvent.keyDown(divider, { key: 'Home' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('still sends other and modified keys pressed on a pane divider to the handler', () => {
    const handler = recorder(false);
    render(
      <>
        <Probe handler={handler} />
        <div aria-label="Resize panes" role="separator" />
      </>,
    );
    const divider = screen.getByRole('separator');

    fireEvent.keyDown(divider, { key: 'j' });
    fireEvent.keyDown(divider, { key: 'ArrowLeft', ctrlKey: true });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('stops listening once unmounted', () => {
    const handler = recorder(true);
    const view = render(<Probe handler={handler} />);

    view.unmount();
    fireEvent.keyDown(window, { key: 'j' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('calls the new handler after a re-render without losing the listener', () => {
    const first = recorder(false);
    const second = recorder(true);
    const view = render(<Probe handler={first} />);

    fireEvent.keyDown(window, { key: 'j' });
    view.rerender(<Probe handler={second} />);
    fireEvent.keyDown(window, { key: 'k' });

    expect(first.seen[0]?.chord).toBe('j');
    expect(second.seen[0]?.chord).toBe('k');
    expect(second.seen[0]?.event.defaultPrevented).toBe(true);
    expect(first).toHaveBeenCalledTimes(1);
  });
});

describe(usePendingKeys, () => {
  it('starts with no prefix and holds the one it is given', () => {
    const { result } = renderHook(() => usePendingKeys('navigation'));

    expect(result.current.prefix).toBeNull();

    act(() => {
      result.current.setPrefix('Ctrl+b');
    });

    expect(result.current.prefix).toBe('Ctrl+b');
  });

  it('gives the prefix up when set to null', () => {
    const { result } = renderHook(() => usePendingKeys('navigation'));
    act(() => {
      result.current.setPrefix('w');
    });

    act(() => {
      result.current.setPrefix(null);
    });

    expect(result.current.prefix).toBeNull();
  });

  it('forgets the prefix when the mode changes', () => {
    const { result, rerender } = renderHook(({ mode }) => usePendingKeys(mode), {
      initialProps: { mode: 'navigation' as InputMode },
    });
    act(() => {
      result.current.setPrefix('w');
    });

    rerender({ mode: 'insert' });

    expect(result.current.prefix).toBeNull();
  });

  it('forgets the prefix when the window loses focus', () => {
    const { result } = renderHook(() => usePendingKeys('navigation'));
    act(() => {
      result.current.setPrefix('w');
    });

    act(() => {
      fireEvent.blur(window);
    });

    expect(result.current.prefix).toBeNull();
  });

  it('stops listening for blur once unmounted', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => usePendingKeys('navigation'));

    unmount();

    expect(remove).toHaveBeenCalledWith('blur', expect.any(Function));
  });
});
