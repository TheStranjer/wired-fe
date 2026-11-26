/**
 * The media tray in the built bundle (WFE-287): `[📎]` at the left of the
 * command line opens the file dialog, a chosen picture shows up as a row of the
 * `Pending media` list above the command line with its thumbnail, the
 * description typed there is put to the instance before the post, and once the
 * post is up the tray is gone. Everything is found by role and accessible name.
 */

import { expect, test, type Page } from '@playwright/test';

import { signIn, submit } from './fixtures/session';
import { ORIGIN, json } from './fixtures/wire';

/** The thumbnail the fake instance gives the upload. */
const PREVIEW_URL = `${ORIGIN}/images/mascot.png`;

/** One transparent pixel, enough for the file input to hold a picture. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Answers uploads with one ready picture and records the bodies of the alt-text puts. */
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

/** Click `Attach media` and choose the picture in the dialog it opens. */
async function attachPicture(page: Page): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Attach media' }).click();
  await (await chooser).setFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PIXEL });
}

/** The tray shows the picture's row, ready, with its thumbnail and the status line's button. */
async function expectTrayRow(page: Page): Promise<void> {
  const tray = page.getByRole('list', { name: 'Pending media' });
  await expect(tray.getByText('pixel.png', { exact: true })).toBeVisible();
  await expect(tray.getByText('ready', { exact: true })).toBeVisible();
  await expect(tray.locator('img')).toHaveAttribute('src', PREVIEW_URL);
  await expect(page.getByRole('button', { name: '1 media waiting, show' })).toBeVisible();
}

/** Go to the first description from the status line and type {@link text} there. */
async function describePicture(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: '1 media waiting, show' }).click();
  const description = page.getByRole('textbox', { name: 'Description for pixel.png' });
  await expect(description).toBeFocused();
  await description.fill(text);
}

test('[📎] attaches a picture into the tray, and describing it then posting empties the tray', async ({
  page,
}) => {
  await signIn(page);
  const descriptions = await routeMedia(page);
  await expect(page.getByRole('list', { name: 'Pending media' })).toHaveCount(0);

  await attachPicture(page);
  await expectTrayRow(page);
  await describePicture(page, 'a wall at night');
  const posted = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/statuses'),
  );
  await submit(page, 'look at this');

  expect((await posted).postDataJSON()).toMatchObject({ media_ids: ['12'] });
  await expect(page.getByRole('list', { name: 'Pending media' })).toHaveCount(0);
  expect(descriptions).toStrictEqual(['{"description":"a wall at night"}']);
});
