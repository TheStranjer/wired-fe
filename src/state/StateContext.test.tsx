/**
 * Tests for the state context: the provider moves the app state through the
 * one reducer so a printed line lands in the status buffer, an initial state
 * is honoured, a dispatch-only consumer does not re-render when the state
 * moves, and both hooks throw outside the provider.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect, type JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { initialAppState } from './appState';
import { appReducer } from './reducer';
import { bufferFor } from './selectors';
import { AppStateProvider, type Dispatch, useAppDispatch, useAppState } from './StateContext';
import { STATUS_WINDOW_ID } from '../windows/model';

const PRINT_DATE = new Date(2026, 0, 2, 23, 4);

/** How many times each test component has committed since the last reset. */
const commits = { reader: 0, dispatchOnly: 0 };

/** Ask the context's dispatch for one client message in the active window. */
function print(dispatch: Dispatch, text: string): void {
  dispatch({ type: 'print', windowId: null, date: PRINT_DATE, level: 'info', text });
}

/** Reads the state: shows the status buffer and prints a line when clicked. */
function StatusReader(): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  useEffect(() => {
    commits.reader += 1;
  });
  const buffer = bufferFor(state, STATUS_WINDOW_ID);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          print(dispatch, 'hello from the command line');
        }}
      >
        print
      </button>
      <ul>
        {buffer.lines.map((line) => (
          <li key={line.key}>{line.kind === 'system' ? line.text : line.key}</li>
        ))}
      </ul>
    </div>
  );
}

/** Never reads the state: only asks for a transition, and tallies its commits. */
function DispatchOnly(): JSX.Element {
  const dispatch = useAppDispatch();
  useEffect(() => {
    commits.dispatchOnly += 1;
  });
  return (
    <button
      type="button"
      onClick={() => {
        print(dispatch, 'printed without reading the state');
      }}
    >
      dispatch only
    </button>
  );
}

/** Reads the state with no provider above it. */
function BareReader(): JSX.Element {
  useAppState();
  return <span>bare</span>;
}

/** Dispatches with no provider above it. */
function BareDispatcher(): JSX.Element {
  useAppDispatch();
  return <span>bare</span>;
}

describe(AppStateProvider, () => {
  it('prints a client message into the status buffer', () => {
    render(
      <AppStateProvider>
        <StatusReader />
      </AppStateProvider>,
    );

    expect(screen.queryByText('hello from the command line')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'print' }));

    expect(screen.getByText('hello from the command line')).toBeInTheDocument();
  });

  it('keeps every printed line, oldest first', () => {
    render(
      <AppStateProvider>
        <StatusReader />
      </AppStateProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'print' }));
    fireEvent.click(screen.getByRole('button', { name: 'print' }));

    expect(screen.getAllByText('hello from the command line')).toHaveLength(2);
  });

  it('starts from the initial state it is given', () => {
    const initial = appReducer(initialAppState(), {
      type: 'print',
      windowId: null,
      date: PRINT_DATE,
      level: 'warn',
      text: 'carried in from before',
    });

    render(
      <AppStateProvider initial={initial}>
        <StatusReader />
      </AppStateProvider>,
    );

    expect(screen.getByText('carried in from before')).toBeInTheDocument();
  });

  it('does not re-render a dispatch-only consumer when the state moves', () => {
    commits.reader = 0;
    commits.dispatchOnly = 0;
    render(
      <AppStateProvider>
        <StatusReader />
        <DispatchOnly />
      </AppStateProvider>,
    );

    expect(commits.dispatchOnly).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'print' }));

    expect(screen.getByText('hello from the command line')).toBeInTheDocument();
    expect(commits.reader).toBeGreaterThan(1);
    expect(commits.dispatchOnly).toBe(1);
  });

  it('lets a consumer that never reads the state still act', () => {
    render(
      <AppStateProvider>
        <StatusReader />
        <DispatchOnly />
      </AppStateProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'dispatch only' }));

    expect(screen.getByText('printed without reading the state')).toBeInTheDocument();
  });

  it('throws from useAppState outside the provider', () => {
    expect(() => {
      render(<BareReader />);
    }).toThrow('useAppState must be used inside AppStateProvider');
  });

  it('throws from useAppDispatch outside the provider', () => {
    expect(() => {
      render(<BareDispatcher />);
    }).toThrow('useAppDispatch must be used inside AppStateProvider');
  });
});
