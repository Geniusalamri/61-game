import { test, expect } from '@playwright/test';

test.describe('Smoke test', () => {
  test('loads the page and renders a canvas', async ({ page }) => {
    await page.goto('/');
    const canvas = await page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});