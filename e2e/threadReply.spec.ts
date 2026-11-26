/**
 * The reply box docked under a thread window (WFE-286): `/thread a0` opens the
 * conversation, and typing into the box under its scrollback and pressing
 * Enter posts the reply — it appears in the thread's log region and the box
 * is empty again.
 */

import { expect, test } from '@playwright/test';

import { logRegion, showWindow, signIn, submit, watchErrors } from './fixtures/session';
import { pane } from './fixtures/tiling';

test('a reply typed in the docked box lands in the thread and empties the box', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await signIn(page);
  await submit(page, '/thread a0');
  await showWindow(page, 'thread/a0');

  const box = pane(page, 'thread/a0').getByRole('textbox', { name: 'Post text' });
  await box.fill('hello thread');
  await box.press('Enter');

  await expect(logRegion(page, 'thread/a0').getByText('hello thread')).toBeVisible();
  await expect(box).toHaveValue('');
  expect(errors).toStrictEqual([]);
});
