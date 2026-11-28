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
  // WFE-135: the ASCII banner shows as art that never reaches the reader.
  const bannerArt = page.locator('div[aria-hidden="true"]', { hasText: '██  ███' }).first();
  await expect(bannerArt).toHaveCount(1);
  await expect(bannerArt).toHaveCSS('white-space', 'pre');
  expect(errors).toStrictEqual([]);
});

test('declares the bundled favicon, served as a PNG', async ({ page }) => {
  await page.goto('/');

  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(href).toBe('./wired.favicon.png');
  const response = await page.request.get(new URL('./wired.favicon.png', page.url()).href);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
});

test('a page at a nested path asks for the favicon where hosting rule 1 serves it', async ({
  page,
}) => {
  // The preview server has no rule 1; it falls back to index.html at any depth.
  await page.goto('/notice/abc');

  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  const requested = new URL(href ?? '', page.url());
  // `/<any path>/wired.<file>` is the shape rule 1 maps back to the root of dist/.
  expect(requested.pathname).toBe('/notice/wired.favicon.png');
  expect(/^\/.+\/wired\.[^/]+$/u.test(requested.pathname)).toBe(true);
  const file = requested.pathname.split('/').pop() ?? '';
  const mapped = await page.request.get(new URL(`/${file}`, page.url()).href);
  expect(mapped.status()).toBe(200);
  expect(mapped.headers()['content-type']).toContain('image/png');
});
