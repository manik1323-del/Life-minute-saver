import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should allow a user to sign up and log in', async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;

    // Go to app
    await page.goto('http://localhost:3000');

    // Switch to Sign Up
    await page.click('button:has-text("Sign Up")');

    // Sign up
    await page.fill('input[placeholder="e.g. Alex Johnson"]', 'E2E Test User');
    await page.fill('input[placeholder="you@example.com"]', email);
    await page.fill('input[placeholder="••••••••"]', 'password123');
    await page.click('button:has-text("Initiate Account")');

    // Should be on dashboard
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });

    // Logout
    await page.click('text=Calibrate Log Out');
    await expect(page.locator('text=Last-Minute Life Saver')).toBeVisible();

    // Login
    await page.click('button:has-text("Log In")');
    await page.fill('input[placeholder="you@example.com"]', email);
    await page.fill('input[placeholder="••••••••"]', 'password123');
    await page.click('button:has-text("Enter Focus Workspace")');

    await expect(page.locator('text=Welcome back')).toBeVisible();
  });
});
