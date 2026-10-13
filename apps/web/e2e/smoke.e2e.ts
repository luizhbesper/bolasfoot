import { expect, test } from '@playwright/test'

test('sem sessão, cai no login e entra como admin', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await page.getByLabel('Usuário').fill(process.env.ADMIN_USERNAME ?? 'admin')
  await page.getByLabel('Senha').fill(process.env.ADMIN_PASSWORD ?? 'admin')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Bolasfoot' })).toBeVisible()
})
