import { expect, test } from '@playwright/test'

test('home carrega', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bolasfoot' })).toBeVisible()
})
