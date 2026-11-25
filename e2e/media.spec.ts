/**
 * The media window in the built bundle (WFE-263, decision 13): `/media <label>`
 * on the fixture post that carries an image opens a float showing the image
 * full size, and its Open original button sends the file to a new tab through
 * `/open`. Everything is found by role and accessible name, never by class.
 */

import { expect, test } from '@playwright/test';

import { IMAGE_ALT } from './fixtures/content';
import { logRegion, signIn, submit } from './fixtures/session';
import { floatOf } from './fixtures/tiling';
import { ORIGIN } from './fixtures/wire';

/** The address the fixture image is served from. */
const IMAGE_URL = `${ORIGIN}/images/mascot.png`;

test('/media opens the post’s image in a float, and Open original opens the file in a tab', async ({
  page,
}) => {
  await signIn(page);
  const card = logRegion(page, 'home')
    .getByRole('article', { name: /^Post \S+ by / })
    .filter({ hasText: 'the LAN is all one network' });
  const name = (await card.getAttribute('aria-label')) ?? '';
  const label = /^Post (\S+) by /u.exec(name)?.[1] ?? '';
  expect(label).not.toBe('');

  await submit(page, `/media ${label}`);

  const float = floatOf(page, 'media');
  await expect(float).toBeVisible();
  await expect(float.getByRole('img', { name: IMAGE_ALT })).toHaveAttribute('src', IMAGE_URL);
  await expect(float.getByText('1/1', { exact: true })).toBeVisible();

  const popup = page.waitForEvent('popup');
  await float.getByRole('button', { name: 'Open original ↗' }).click();

  const opened = await popup;
  await expect.poll(() => opened.url()).toBe(IMAGE_URL);
});

test('clicking a card’s image opens the media float instead of a tab, and Open original still pops the file', async ({
  page,
}) => {
  const popups: string[] = [];
  page.on('popup', (opened) => popups.push(opened.url()));
  await signIn(page);
  const card = logRegion(page, 'home')
    .getByRole('article', { name: /^Post \S+ by / })
    .filter({ hasText: 'the LAN is all one network' });

  await card.getByRole('img', { name: IMAGE_ALT }).click();

  const float = floatOf(page, 'media');
  await expect(float.getByRole('img', { name: IMAGE_ALT })).toHaveAttribute('src', IMAGE_URL);
  expect(popups).toStrictEqual([]);

  const popup = page.waitForEvent('popup');
  await float.getByRole('button', { name: 'Open original ↗' }).click();

  const opened = await popup;
  await expect.poll(() => opened.url()).toBe(IMAGE_URL);
});
