import { expect, test } from '@playwright/test';

test.describe('protected routes', () => {
  test('unauthenticated user is redirected from /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });
});
