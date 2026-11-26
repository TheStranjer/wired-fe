/**
 * Media in the DM window's docked box (WFE-289): `/query alice` opens the
 * conversation, `[📎]` in the box (not the command line's) takes a picture into
 * the box's own row, sending posts it with its id and the description put
 * before it, and the posted message shows the attachment while the box is
 * empty again and the command line's tray stayed out of it. Everything is
 * found by role and accessible name.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { logRegion, showWindow, signIn } from './fixtures/session';
import { pane } from './fixtures/tiling';
import { ORIGIN, json, statusJson } from './fixtures/wire';

/** The picture the fake instance serves as the upload and as the posted attachment. */
const PICTURE_URL = `${ORIGIN}/images/mascot.png`;

/** One transparent pixel, enough for the file input to hold a picture. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** The attachment document of the upload `12`. */
const ATTACHMENT = {
  id: '12',
  type: 'image',
  url: PICTURE_URL,
  preview_url: PICTURE_URL,
  remote_url: null,
  description: 'a wall at night',
  blurhash: null,
};

/** Answers the upload, the alt-text put and the create with a direct post carrying the picture. */
async function routeMedia(page: Page): Promise<string[]> {
  const bodies: string[] = [];
  await page.route('**/api/v2/media', async (route) => {
    await json(route, { ...ATTACHMENT, description: null });
  });
  await page.route('**/api/v1/media/*', async (route) => {
    bodies.push(JSON.stringify(route.request().postDataJSON()));
    await json(route, ATTACHMENT);
  });
  await page.route('**/api/v1/statuses', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    bodies.push(JSON.stringify(route.request().postDataJSON()));
    await json(
      route,
      statusJson({
        id: '900000000000000001',
        who: { id: 'AhZlainAcc00000000000001', name: 'lain', display: 'Lain Iwakura' },
        html: '<p>@alice look</p>',
        at: new Date().toISOString(),
        visibility: 'direct',
        pictures: [{ id: '12', url: PICTURE_URL, description: 'a wall at night' }],
      }),
    );
  });
  return bodies;
}

/** Opens the conversation with alice and gives back its pane. */
async function openDm(page: Page): Promise<Locator> {
  const line = page.getByRole('combobox', { name: 'Command line' });
  await line.fill('/query alice');
  await line.press('Enter');
  await showWindow(page, 'dm/alice');
  return pane(page, 'dm/alice');
}

/** Picks the picture in the box's own file dialog, and waits for its row to be ready. */
async function attachPicture(page: Page, box: Locator): Promise<Locator> {
  const chooser = page.waitForEvent('filechooser');
  await box.getByRole('button', { name: 'Attach media' }).click();
  await (await chooser).setFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PIXEL });
  const rows = box.getByRole('list', { name: 'Attachments' });
  await expect(rows.getByText('ready', { exact: true })).toBeVisible();
  return rows;
}

/** Describes the picture in {@link rows}, writes `look` in {@link box} and presses Enter. */
async function describeAndSend(box: Locator, rows: Locator): Promise<Locator> {
  await rows.getByRole('textbox', { name: 'Description for pixel.png' }).fill('a wall at night');
  const text = box.getByRole('textbox', { name: 'Post text' });
  await text.fill('look');
  await text.press('Enter');
  return text;
}

test('a picture attached in the DM box is sent with the message and shows in the conversation', async ({
  page,
}) => {
  await signIn(page);
  const bodies = await routeMedia(page);
  const box = await openDm(page);

  const rows = await attachPicture(page, box);
  await expect(page.getByRole('list', { name: 'Pending media' })).toHaveCount(0);
  const text = await describeAndSend(box, rows);

  await expect(
    logRegion(page, 'dm/alice').getByRole('img', { name: 'a wall at night' }),
  ).toBeVisible();
  await expect(text).toHaveValue('');
  await expect(rows).toHaveCount(0);
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toBe('{"description":"a wall at night"}');
  expect(JSON.parse(bodies[1] ?? '{}')).toMatchObject({ visibility: 'direct', media_ids: ['12'] });
});
