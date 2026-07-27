import { test, expect } from '@playwright/test';

test.describe('Task Management', () => {
  const email = `task-user-${Date.now()}@example.com`;

  test.beforeEach(async ({ page }) => {
    // Auto-login (Sandbox mode)
    await page.goto('http://localhost:3000');
    await page.fill('input[placeholder="you@example.com"]', email);
    await page.fill('input[placeholder="••••••••"]', 'password123');
    await page.click('button:has-text("Enter Focus Workspace")');
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });
  });

  test('should create, edit, and delete a task', async ({ page }) => {
    await page.click('button:has-text("Task Board")');

    // Create
    await page.click('button:has-text("New Task")');
    await page.fill('input[placeholder="e.g. Draft Executive Hackathon Pitch"]', 'E2E Task');
    await page.fill('textarea[placeholder="What details are critical to finish before the deadline?"]', 'E2E Description');
    await page.click('button:has-text("Initiate Task")');

    await expect(page.locator('text=E2E Task')).toBeVisible();

    // Edit (Expand first)
    await page.click('text=E2E Task');
    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('In Progress');

    // Deletion
    page.on('dialog', dialog => dialog.accept());
    await page.click('text=Delete Task');

    await expect(page.locator('text=E2E Task')).not.toBeVisible();
  });
});
