/**
 * Tests for files pasted or dropped onto a thread window (WFE-289): they
 * become rows of the docked box's own media, never of the command line's
 * pending media, and the window-wide listeners of the shell do not hear them;
 * a thread that failed to load has no box and takes none.
 */
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { windowKind } from './windowKind';
import { COMMAND_LINE_MEDIA, composerMediaOf } from '../../state/composerMedia';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import { picture, servingUploads } from '../../test/attachmentHarness';
import { THREAD_WINDOW, serveThread, threadState } from '../../test/threadWindow';

/** A drag or paste payload carrying {@link files}. */
function carrying(files: readonly File[]): Record<string, unknown> {
  return { types: ['Files'], files };
}

/** Shows how many lines the command line's own media holds. */
function PendingProbe(): JSX.Element {
  const held = composerMediaOf(useAppState(), COMMAND_LINE_MEDIA).length;
  return <output>{`pending:${String(held)}`}</output>;
}

/** The thread window over a served thread, next to the command line's media count. */
function renderWindow(failures: { status?: boolean } = {}): void {
  serveThread(failures);
  servingUploads();
  const { Component } = windowKind;
  render(
    <AppStateProvider initial={threadState()}>
      <Component windowId={THREAD_WINDOW} />
      <PendingProbe />
    </AppStateProvider>,
  );
}

describe('files onto a thread window', () => {
  it('attaches a file pasted into the box to the box, and the window never hears it', async () => {
    renderWindow();
    await screen.findByText('the fourth wall');
    const heard = vi.fn();
    window.addEventListener('paste', heard);
    const box = screen.getByRole('textbox', { name: 'Post text' });

    fireEvent(box, createEvent.paste(box, { clipboardData: carrying([picture('pasted.png')]) }));
    window.removeEventListener('paste', heard);
    await screen.findByText('ready');

    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('pasted.png');
    expect(screen.getByText('pending:0')).toBeInTheDocument();
    expect(heard).not.toHaveBeenCalled();
  });

  it('attaches a file dropped onto the pane to the box', async () => {
    renderWindow();
    await screen.findByText('the fourth wall');
    const pane = screen.getByRole('log', { name: 'thread/a2' });

    fireEvent(pane, createEvent.drop(pane, { dataTransfer: carrying([picture('dropped.png')]) }));
    await screen.findByText('ready');

    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('dropped.png');
    expect(screen.getByText('pending:0')).toBeInTheDocument();
  });

  it('takes no file while the thread failed to load and has no box', async () => {
    renderWindow({ status: true });
    await screen.findByText('HTTP 404: Record not found');
    const pane = screen.getByRole('log', { name: 'thread/a2' });
    const drop = createEvent.drop(pane, { dataTransfer: carrying([picture('dropped.png')]) });

    fireEvent(pane, drop);

    expect(drop.defaultPrevented).toBe(false);
    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });
});
