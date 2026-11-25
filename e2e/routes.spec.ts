import { expect, test } from '@playwright/test';

import { signIn } from './fixtures/session';

test('loading the built bundle at #/tag/rust opens the tag window for the signed-in account', async ({
  page,
}) => {
  await signIn(page);

  await page.goto('about:blank');
  await page.goto('/#/tag/rust');

  await expect(page.getByRole('log', { name: '#rust' })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
});
