/**
 * useGlobalKeys and the text box with a suggestion list (WFE-302): the Escape
 * that closes an open list is the box's, not the shortcut that leaves for
 * navigation mode; every other key and every other Escape still reaches the
 * handler.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useGlobalKeys } from './useGlobalKeys';
import type { ChordHandler } from './useGlobalKeys';

/** A component that mounts the hook under test and nothing else. */
function Probe({ handler }: { readonly handler: ChordHandler }): JSX.Element {
  useGlobalKeys(handler);
  return <p>keys probe</p>;
}

/** A handler that answers {@link result} and counts its calls. */
function recorder(result: boolean): ChordHandler {
  return vi.fn((): boolean => result);
}

describe('useGlobalKeys with a text box that has a suggestion list', () => {
  it('keeps the Escape that closes a text box’s open suggestion list from the handler', () => {
    const handler = recorder(true);
    render(
      <>
        <Probe handler={handler} />
        <textarea aria-controls="open-list" aria-label="Post text" />
        <div>
          <div id="open-list" role="listbox" />
        </div>
      </>,
    );

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('still sends the Escape of a text box whose list is hidden, missing or not named', () => {
    const handler = recorder(false);
    render(
      <>
        <Probe handler={handler} />
        <textarea aria-controls="shut-list" aria-label="Shut" />
        <div hidden>
          <div id="shut-list" role="listbox" />
        </div>
        <textarea aria-controls="nowhere" aria-label="Lost" />
        <textarea aria-label="Plain" />
        <input aria-controls="open-list" aria-label="Line" />
      </>,
    );

    fireEvent.keyDown(screen.getByLabelText('Shut'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByLabelText('Lost'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByLabelText('Plain'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByLabelText('Line'), { key: 'Escape' });

    expect(handler).toHaveBeenCalledTimes(4);
  });

  it('still sends the other keys of a text box whose list is open', () => {
    const handler = recorder(false);
    render(
      <>
        <Probe handler={handler} />
        <textarea aria-controls="open-list" aria-label="Post text" />
        <div id="open-list" role="listbox" />
      </>,
    );

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'j' });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
