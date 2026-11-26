/**
 * Tests for files pasted or dropped onto a DM window (WFE-289): they become
 * rows of the docked box's own media, never of the command line's pending
 * media, and the window-wide listeners of the shell do not hear them.
 */
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DmWindow } from './DmWindow';
import { COMMAND_LINE_MEDIA, composerMediaOf } from '../../state/composerMedia';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import { picture, servingUploads } from '../../test/attachmentHarness';
import { DM_WINDOW, dmState, serveDirect } from '../../test/dmWindow';

/** A drag or paste payload carrying {@link files}. */
function carrying(files: readonly File[]): Record<string, unknown> {
  return { types: ['Files'], files };
}

/** Shows how many lines the command line's own media holds. */
function PendingProbe(): JSX.Element {
  const held = composerMediaOf(useAppState(), COMMAND_LINE_MEDIA).length;
  return <output>{`pending:${String(held)}`}</output>;
}

/** The DM window over a served conversation, next to the command line's media count. */
function renderWindow(): void {
  serveDirect();
  servingUploads();
  render(
    <AppStateProvider initial={dmState()}>
      <DmWindow windowId={DM_WINDOW} />
      <PendingProbe />
    </AppStateProvider>,
  );
}

describe('files onto a DM window', () => {
  it('attaches a file pasted into the box to the box, and the window never hears it', async () => {
    renderWindow();
    const heard = vi.fn();
    window.addEventListener('paste', heard);
    const event = createEvent.paste(screen.getByRole('textbox', { name: 'Post text' }), {
      clipboardData: carrying([picture('pasted.png')]),
    });

    fireEvent(screen.getByRole('textbox', { name: 'Post text' }), event);
    window.removeEventListener('paste', heard);
    await screen.findByText('ready');

    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('pasted.png');
    expect(screen.getByText('pending:0')).toBeInTheDocument();
    expect(heard).not.toHaveBeenCalled();
  });

  it('attaches a file dropped onto the pane to the box', async () => {
    renderWindow();
    const pane = await screen.findByRole('log', { name: 'dm/alice@other.example' });
    const heard = vi.fn();
    window.addEventListener('drop', heard);

    fireEvent(
      pane,
      createEvent.dragOver(pane, { dataTransfer: carrying([picture('dropped.png')]) }),
    );
    fireEvent(pane, createEvent.drop(pane, { dataTransfer: carrying([picture('dropped.png')]) }));
    window.removeEventListener('drop', heard);
    await screen.findByText('ready');

    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('dropped.png');
    expect(screen.getByText('pending:0')).toBeInTheDocument();
    expect(heard).not.toHaveBeenCalled();
  });
});
