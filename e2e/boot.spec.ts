import { expect, test } from '@playwright/test';

test('boots the built bundle under its CSP without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('WIRED');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  await expect(page.getByText('WIRED // WIRED', { exact: true })).toBeVisible();
  await expect(page.getByText('Present day. Present time.', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Not connected. Type /connect to log in.', { exact: true }),
  ).toBeVisible();
  expect(errors).toStrictEqual([]);
});
