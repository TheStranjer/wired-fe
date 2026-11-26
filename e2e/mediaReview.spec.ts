/**
 * The review of alt text before a send, in the built bundle (WFE-290): a
 * picture attached through `Attach media` without a description makes Enter on
 * the command line open the `Describe media` dialog instead of posting, with
 * the picture's textarea focused; typing the alt text and pressing Enter sends
 * it before the post, the line appears and the tray empties. With the alt text
 * typed in the tray first there is no dialog at all. Everything is found by
 * role and accessible name.
 */

import { expect, test, type Page } from '@playwright/test';

import { logRegion, signIn, submit } from './fixtures/session';
import { ORIGIN, json } from './fixtures/wire';

/** The thumbnail the fake instance gives the upload. */
const PREVIEW_URL = `${ORIGIN}/images/mascot.png`;

/** One transparent pixel, enough for the file input to hold a picture. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Answers uploads with one ready picture and records the alt-text puts. */
async function routeMedia(page: Page): Promise<string[]> {
  const descriptions: string[] = [];
  await page.route('**/api/v2/media', async (route) => {
    await json(route, {
      id: '12',
      type: 'image',
      url: PREVIEW_URL,
      preview_url: PREVIEW_URL,
      remote_url: null,
      description: null,
      blurhash: null,
    });
  });
  await page.route('**/api/v1/media/*', async (route) => {
    descriptions.push(JSON.stringify(route.request().postDataJSON()));
    await json(route, { id: '12', type: 'image', url: PREVIEW_URL });
  });
  return descriptions;
}

/** Click `Attach media`, choose the picture, and wait for its tray row. */
async function attachPicture(page: Page): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Attach media' }).click();
  await (await chooser).setFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PIXEL });
  await expect(page.getByRole('list', { name: 'Pending media' })).toContainText('ready');
}

test('Enter with an undescribed picture opens the review, and its Enter sends the post', async ({
  page,
}) => {
  await signIn(page);
  const descriptions = await routeMedia(page);
  await attachPicture(page);

  await submit(page, 'hello');
  const dialog = page.getByRole('dialog', { name: 'Describe media' });
  const field = dialog.getByRole('textbox', { name: 'Description for pixel.png' });

  await expect(dialog).toBeVisible();
  await expect(field).toBeFocused();
  expect(descriptions).toStrictEqual([]);

  await field.fill('a wall at night');
  await field.press('Enter');

  await expect(logRegion(page, 'home').locator('article').last()).toContainText('hello');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Pending media' })).toHaveCount(0);
  expect(descriptions).toStrictEqual(['{"description":"a wall at night"}']);
});

test('Enter on a blank line posts the pending picture after the review', async ({ page }) => {
  await signIn(page);
  const descriptions = await routeMedia(page);
  await attachPicture(page);

  await page.getByRole('textbox', { name: 'Command line' }).press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Describe media' });
  const field = dialog.getByRole('textbox', { name: 'Description for pixel.png' });

  await expect(dialog).toBeVisible();
  await field.fill('a wall at night');
  await field.press('Enter');

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Pending media' })).toHaveCount(0);
  expect(descriptions).toStrictEqual(['{"description":"a wall at night"}']);
});

test('a picture described in the tray first is sent with no dialog', async ({ page }) => {
  await signIn(page);
  await routeMedia(page);
  await attachPicture(page);
  await page.getByRole('textbox', { name: 'Description for pixel.png' }).fill('a wall at night');

  await submit(page, 'hello');

  await expect(logRegion(page, 'home').locator('article').last()).toContainText('hello');
  await expect(page.getByRole('dialog', { name: 'Describe media' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Pending media' })).toHaveCount(0);
});
