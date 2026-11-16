/**
 * Tests for the Tab seam of the command line (WFE-124) over one fixed
 * provider: Tab starts a completion and steps forward, Tab wraps and
 * Shift+Tab steps back, any other key ends the completion in progress, a
 * line rewritten without a keystroke restarts it instead of cycling stale
 * text, a word nothing completes leaves Tab to the browser, navigation mode
 * leaves the chord alone, and Enter clears the completion with the rest of
 * the line. The engine itself is tested in src/commands; the whole shell is
 * tested in ./Root.completion.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { useCompletion } from './useCompletion';
import type { Provider } from '../commands/complete';
import type { InputModeState } from '../state/appState';
import { InputLine } from '../ui/InputLine';

/** A provider over two words: everything these tests complete goes through it. */
const FRUITS: Provider = {
  accepts: (word) => word.startsWith('#'),
  candidates: (word) =>
    ['#apple', '#banana'].filter((fruit) => fruit.startsWith(word.toLowerCase())),
};

/** The command line steered by the hook alone, over the given providers. */
function Harness(props: {
  readonly mode: InputModeState;
  readonly providers: readonly Provider[];
}): JSX.Element {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onKeyDown = useCompletion({
    inputRef,
    mode: props.mode,
    providers: props.providers,
    value,
    setValue,
  });

  return (
    <InputLine
      prompt=">"
      value={value}
      onChange={setValue}
      onSubmit={(text: string) => {
        setValue(text.toUpperCase());
      }}
      onKeyDown={onKeyDown}
      inputRef={inputRef}
    />
  );
}

/** The command line under test. */
function line(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Command line' });
}

/** Shows {@link text} on the line, as typing it would. */
function type(text: string): void {
  fireEvent.change(line(), { target: { value: text } });
}

/** Presses Tab — with Shift when told to; true when the browser kept the key. */
function tab(shiftKey = false): boolean {
  return fireEvent.keyDown(line(), { key: 'Tab', shiftKey });
}

describe(useCompletion, () => {
  it('starts on the first candidate and steps forward', () => {
    render(<Harness mode="insert" providers={[FRUITS]} />);

    type('#');

    expect(tab()).toBe(false);
    expect(line()).toHaveValue('#apple ');

    expect(tab()).toBe(false);
    expect(line()).toHaveValue('#banana ');
  });

  it('wraps at the end and steps back with Shift+Tab', () => {
    render(<Harness mode="insert" providers={[FRUITS]} />);

    type('#');

    tab();

    tab();

    expect(line()).toHaveValue('#banana ');

    tab(true);

    expect(line()).toHaveValue('#apple ');

    expect(tab(true)).toBe(false);
    expect(line()).toHaveValue('#banana ');
  });

  it('ends the completion when any other key is pressed', () => {
    render(<Harness mode="insert" providers={[FRUITS]} />);

    type('#');

    tab();

    expect(line()).toHaveValue('#apple ');

    fireEvent.keyDown(line(), { key: 'z' });

    expect(tab()).toBe(true);
    expect(line()).toHaveValue('#apple ');
  });

  it('restarts rather than cycles when the line was rewritten without a keystroke', () => {
    render(<Harness mode="insert" providers={[FRUITS]} />);

    type('#');

    tab();

    expect(line()).toHaveValue('#apple ');

    type('#b');

    expect(tab()).toBe(false);
    expect(line()).toHaveValue('#banana ');
  });

  it('leaves Tab to the browser when nothing matches and when the line is empty', () => {
    render(<Harness mode="insert" providers={[FRUITS]} />);

    type('#zz');

    expect(tab()).toBe(true);
    expect(line()).toHaveValue('#zz');

    type('');

    expect(tab()).toBe(true);
  });

  it('leaves the chord alone outside insert mode', () => {
    render(<Harness mode="navigation" providers={[FRUITS]} />);

    type('#');

    expect(tab()).toBe(true);
    expect(line()).toHaveValue('#');
  });

  it('clears the completion with the rest of the line when Enter submits', () => {
    render(<Harness mode="insert" providers={[FRUITS]} />);

    type('#');

    tab();

    fireEvent.keyDown(line(), { key: 'Enter' });

    expect(line()).toHaveValue('#APPLE ');

    type('#');

    expect(tab()).toBe(false);
    expect(line()).toHaveValue('#apple ');
  });
});
