import { test, expect } from '@playwright/test';

test.describe('Last-Minute Life Saver Core Journey', () => {
  const email = `user-${Date.now()}@example.com`;

  test('should complete the full user journey', async ({ page }) => {
    // 1. Signup & Welcome
    await page.goto('/');
    await page.click('button:has-text("Sign Up")');
    await page.fill('input[placeholder="e.g. Alex Johnson"]', 'Automation User');
    await page.fill('input[placeholder="you@example.com"]', email);
    await page.fill('input[placeholder="••••••••"]', 'password123');
    await page.click('button:has-text("Initiate Account")');

    await expect(page.getByText(/Welcome back/i)).toBeVisible({ timeout: 20000 });
    console.log('Signup successful');

    // 2. Task Management
    console.log('Navigating to Task Board');
    await page.click('text=Task Board');

    console.log('Waiting for Tasks content');
    await expect(page.getByText(/AI Risk Audit/i)).toBeVisible({ timeout: 20000 });

    console.log('Clicking New Task');
    await page.click('button:has-text("New Task")');
    await page.fill('input[placeholder="e.g. Draft Executive Hackathon Pitch"]', 'E2E Task');
    await page.fill('textarea', 'E2E Description');
    await page.click('button:has-text("Initiate Task")');

    await expect(page.getByText('E2E Task').first()).toBeVisible({ timeout: 15000 });
    console.log('Task created');

    // 3. AI Coach
    console.log('Navigating to AI Coach');
    await page.click('text=AI Coach');
    await expect(page.getByText(/Initiate Mindset Calibration/i)).toBeVisible({ timeout: 15000 });
    await page.fill('input[type="text"]', 'Give me advice.');
    await page.click('button[aria-label="Send message"]');
    await expect(page.getByText(/advice/i).or(page.getByText(/master them/i))).toBeVisible({ timeout: 30000 });
    console.log('AI Coach response received');

    // 4. Analytics
    console.log('Navigating to Analytics');
    await page.click('text=Analytics');
    await expect(page.getByText(/Productivity Analytics/i)).toBeVisible();
    console.log('Analytics loaded');

    // 5. Settings & Theme
    console.log('Navigating to Settings');
    await page.click('text=Settings');
    await page.click('text=Modern Light Mode');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.click('text=Cosmic Dark Mode');
    await expect(page.locator('html')).toHaveClass(/dark/);
    console.log('Theme toggle successful');

    // 6. Rescue My Day
    console.log('Testing Rescue My Day modal');
    await page.click('button:has-text("Rescue My Day")');
    await expect(page.getByText(/Emergency Rescue Mode/i)).toBeVisible();
    await page.click('button:has-text("E2E Task")');
    await page.fill('input[type="number"]', '3');
    await page.click('button:has-text("Generate Rescue Plan")');
    await expect(page.getByText(/Recovery Summary/i)).toBeVisible({ timeout: 20000 });
    console.log('Rescue plan generated');
    // Close modal via the X button
    await page.locator('button >> .lucide-x').first().click();

    // 7. Logout
    await page.click('text=Calibrate Log Out');
    await expect(page.getByText(/Last-Minute Life Saver/i)).toBeVisible();
    console.log('Logout successful');
  });
});
