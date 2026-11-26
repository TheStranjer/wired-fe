/**
 * Tests for the review of alt text before a send, through the whole shell
 * (WFE-290): a post from the command line with an undescribed attachment opens
 * the `Describe media` dialog and sends nothing yet; Enter in its textarea
 * sends the typed text before the post and empties the tray; Escape sends
 * nothing and keeps the line, the media and what was typed; described media
 * go out with no dialog; and the text after `/home` goes through the same
 * gate. Startup is mocked.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { attachOne, renderShell, seen, serveInstance, submit } from '../test/trayHarness';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** Render the whole shell and attach one undescribed picture. */
async function withPicture(): Promise<void> {
  await attachOne(renderShell(<Root />));
}

/** The dialog's description textarea (the tray's input has the same name, outside the dialog). */
function field(): HTMLElement {
  return within(screen.getByRole('dialog', { name: 'Describe media' })).getByRole('textbox', {
    name: 'Description for pixel.png',
  });
}

/** The command line. */
function line(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Command line' });
}

/** Wait for the review dialog and type {@link text} into its textarea. */
async function review(text: string): Promise<void> {
  await screen.findByRole('dialog', { name: 'Describe media' });
  fireEvent.change(field(), { target: { value: text } });
}

describe('reviewing alt text before sending media', () => {
  beforeEach(() => {
    serveInstance(200);
  });

  it('holds the post, focuses the missing description, and sends the typed text on Enter', async () => {
    await withPicture();

    submit('look at this');
    await review('a wall at night');

    expect(seen()).toStrictEqual([]);
    expect(screen.getByRole('dialog', { name: 'Describe media' })).toHaveAccessibleDescription(
      '1 of 1 attachments have no description',
    );

    fireEvent.keyDown(field(), { key: 'Enter' });

    await waitFor(() => {
      expect(screen.queryByRole('list', { name: 'Pending media' })).toBeNull();
    });

    expect(seen()).toStrictEqual(['put 12 a wall at night', 'post']);
    expect(line()).toHaveValue('');
  });

  it('focuses the textarea of the attachment that has no description', async () => {
    await withPicture();

    submit('look at this');
    await screen.findByRole('dialog', { name: 'Describe media' });

    expect(field()).toHaveFocus();
  });

  it('sends nothing on Escape and keeps the line, the media and what was typed', async () => {
    await withPicture();

    submit('look at this');
    await review('a wall at night');
    fireEvent.keyDown(field(), { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Describe media' })).toBeNull();
    });

    expect(seen()).toStrictEqual([]);
    expect(line()).toHaveValue('look at this');
    expect(screen.getByRole('textbox', { name: 'Description for pixel.png' })).toHaveValue(
      'a wall at night',
    );
  });

  it('sends at once, with no dialog, when every attachment is described', async () => {
    await withPicture();
    fireEvent.change(screen.getByRole('textbox', { name: 'Description for pixel.png' }), {
      target: { value: 'a wall at night' },
    });

    submit('look at this');

    expect(screen.queryByRole('dialog', { name: 'Describe media' })).toBeNull();

    await waitFor(() => {
      expect(seen()).toStrictEqual(['put 12 a wall at night', 'post']);
    });
  });

  it('gates the text after /home the same way', async () => {
    await withPicture();

    submit('/home hello');
    await review('a wall at night');
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(seen()).toStrictEqual(['put 12 a wall at night', 'post']);
    });
  });

  it('posts nothing after /home when the review is cancelled', async () => {
    await withPicture();

    submit('/home hello');
    await screen.findByRole('dialog', { name: 'Describe media' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Describe media' })).toBeNull();
    });

    expect(seen()).toStrictEqual([]);
    expect(line()).toHaveValue('/home hello');
  });
});
