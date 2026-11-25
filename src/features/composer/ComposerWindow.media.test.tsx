/**
 * Tests for attaching media in the composer window (WFE-205): the attach
 * button opens the file input and a chosen file becomes a line with its
 * thumbnail, name, alt-text input and state; pasting and dropping onto the pane
 * attach there and the shell's window listeners never see them; two composers
 * keep separate media; a line is removed with `[x]`.
 */
import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WIRED, openedComposer } from './composerSession';
import {
  acceptingUploads,
  choose,
  chooseNothing,
  fileInput,
  picture,
  renderComposers,
  showComposer,
  withSecondComposer,
} from './mediaHarness';
import { server } from '../../test/server';

/** The text of each line of attachments list {@link list}. */
function itemTexts(list: HTMLElement): readonly (string | null)[] {
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

/** A drag or paste payload carrying {@link files}. */
function carrying(files: readonly File[]): Record<string, unknown> {
  return { types: ['Files'], files };
}

describe('attaching in the composer window', () => {
  it('opens the file input from the attach button and shows a line for the chosen file', async () => {
    server.use(acceptingUploads());
    showComposer();
    const click = vi.spyOn(fileInput(), 'click').mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));
    choose([picture('cat.png')]);

    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByText('cat.png')).toBeInTheDocument();
    expect(screen.getByText('uploading…')).toBeInTheDocument();

    await screen.findByText('ready');

    expect(screen.getByRole('textbox', { name: 'Description for cat.png' })).toHaveValue('');
    expect(screen.getByRole('list', { name: 'Attachments' }).querySelector('img')).toHaveAttribute(
      'src',
      `${WIRED}/media/m1.thumb.png`,
    );
  });

  it('attaches nothing when the dialog is closed without a choice', () => {
    showComposer();

    chooseNothing();

    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });

  it('attaches several chosen files at once', async () => {
    server.use(acceptingUploads());
    showComposer();

    choose([picture('a.png'), picture('b.png')]);

    await waitFor(() => {
      expect(screen.getAllByText('ready')).toHaveLength(2);
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('attaches a file pasted into the pane and keeps it from the window listeners', async () => {
    server.use(acceptingUploads());
    showComposer();
    const heard = vi.fn();
    window.addEventListener('paste', heard);

    const event = createEvent.paste(screen.getByRole('textbox', { name: 'Post text' }), {
      clipboardData: carrying([picture('pasted.png')]),
    });
    fireEvent(screen.getByRole('textbox', { name: 'Post text' }), event);
    window.removeEventListener('paste', heard);

    await screen.findByText('ready');

    expect(screen.getByText('pasted.png')).toBeInTheDocument();
    expect(event.defaultPrevented).toBe(true);
    expect(heard).not.toHaveBeenCalled();
  });

  it('leaves a text paste to the textarea', () => {
    showComposer();
    const heard = vi.fn();
    window.addEventListener('paste', heard);

    const event = createEvent.paste(screen.getByRole('textbox', { name: 'Post text' }), {
      clipboardData: { files: [] },
    });
    fireEvent(screen.getByRole('textbox', { name: 'Post text' }), event);
    window.removeEventListener('paste', heard);

    expect(event.defaultPrevented).toBe(false);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });

  it('attaches files dropped onto the pane and keeps them from the window listeners', async () => {
    server.use(acceptingUploads());
    showComposer();
    const heard = vi.fn();
    window.addEventListener('drop', heard);
    const pane = screen.getByRole('textbox', { name: 'Post text' });

    const over = createEvent.dragOver(pane, { dataTransfer: carrying([picture('dropped.png')]) });
    fireEvent(pane, over);
    const drop = createEvent.drop(pane, { dataTransfer: carrying([picture('dropped.png')]) });
    fireEvent(pane, drop);
    window.removeEventListener('drop', heard);

    await screen.findByText('ready');

    expect(screen.getByText('dropped.png')).toBeInTheDocument();
    expect(over.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
    expect(heard).not.toHaveBeenCalled();
  });

  it('lets a drag that carries no files pass, and a leave end the drag', () => {
    showComposer();
    const pane = screen.getByRole('textbox', { name: 'Post text' });

    const text = createEvent.dragOver(pane, { dataTransfer: { types: ['text/plain'], files: [] } });
    fireEvent(pane, text);
    const dropped = createEvent.drop(pane, { dataTransfer: { types: ['text/plain'], files: [] } });
    fireEvent(pane, dropped);
    fireEvent(pane, createEvent.dragOver(pane, { dataTransfer: carrying([]) }));
    fireEvent.dragLeave(pane);

    expect(text.defaultPrevented).toBe(false);
    expect(dropped.defaultPrevented).toBe(false);
    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });

  it('keeps the media of two composers apart', async () => {
    server.use(acceptingUploads());
    const first = openedComposer();
    const second = withSecondComposer(first);
    renderComposers(second, [first.windows.activeId, second.windows.activeId]);

    choose([picture('one.png')], 0);
    await screen.findByText('ready');
    choose([picture('two.png')], 1);
    await waitFor(() => {
      expect(screen.getAllByText('ready')).toHaveLength(2);
    });

    const lists = screen.getAllByRole('list', { name: 'Attachments' }).map(itemTexts);

    expect(lists).toStrictEqual([
      [expect.stringContaining('one.png')],
      [expect.stringContaining('two.png')],
    ]);
  });

  it('removes a line with its [x]', async () => {
    server.use(acceptingUploads());
    showComposer();
    choose([picture('cat.png')]);
    await screen.findByText('ready');

    fireEvent.click(screen.getByRole('button', { name: 'Remove cat.png' }));

    expect(screen.queryByText('cat.png')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });
});
