import { test, expect } from '@playwright/test';

test.describe('Theme Switching', () => {
  test('should switch theme and persist after refresh', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.fill('input[placeholder="you@example.com"]', 'theme@example.com');
    await page.fill('input[placeholder="••••••••"]', 'password123');
    await page.click('button:has-text("Enter Focus Workspace")');

    await page.click('button:has-text("Settings")');

    // Switch to Light Mode
    await page.click('text=Modern Light Mode');
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Refresh
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Switch to Dark Mode
    await page.click('text=Cosmic Dark Mode');
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
