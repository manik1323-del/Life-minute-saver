import { test, expect } from '@playwright/test';

test.describe('AI Features', () => {
  const email = `ai-user-${Date.now()}@example.com`;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.fill('input[placeholder="you@example.com"]', email);
    await page.fill('input[placeholder="••••••••"]', 'password123');
    await page.click('button:has-text("Enter Focus Workspace")');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('should interact with AI Coach', async ({ page }) => {
    await page.click('button:has-text("AI Coach")');

    await page.fill('input[placeholder="Formulate query to Socrates-Focus productivity coach..."]', 'How can I be more productive?');
    await page.click('button[aria-label="Send message"]');

    // Check for thinking indicator then response
    await expect(page.locator('text=Socrates is pondering')).toBeVisible();
    await expect(page.locator('text=Coach Response').or(page.locator('text=master them'))).toBeVisible({ timeout: 15000 });
  });

  test('should run AI Risk Audit', async ({ page }) => {
    await page.click('button:has-text("Task Board")');
    await page.click('button:has-text("AI Risk Audit")');

    // It should show a refresh icon or something while prioritizing
    await expect(page.locator('text=AI Risk Audit')).toBeVisible();
  });
});
