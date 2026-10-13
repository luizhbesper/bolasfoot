import { expect, test } from '@playwright/test'

// Plano §6.5 #3 (mobile smoke): jogo novo sozinho, escolhe o time, abre hub e escalação no celular e troca um jogador.
test.use({ viewport: { width: 390, height: 844 } })

test('celular: escolhe o time, abre o hub e troca um jogador na escalação', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/entrar')
  await page.getByLabel('Usuário').fill(process.env.ADMIN_USERNAME ?? 'admin')
  await page.getByLabel('Senha').fill(process.env.ADMIN_PASSWORD ?? 'admin')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Bolasfoot' })).toBeVisible()

  // admin cria o jogo (já é membro) e abre a escolha
  await page.goto('/admin')
  await page.getByLabel('Nome').fill(`E2E clube ${Date.now()}`)
  await page.getByRole('button', { name: 'Criar jogo' }).click()
  await page.getByRole('button', { name: 'Iniciar escolha de times' }).click()
  await page.getByRole('link', { name: 'Abrir o jogo' }).click()

  await page.getByRole('searchbox', { name: 'Buscar time' }).fill('Bahia')
  await page.getByRole('button', { name: /^Bahia BA/ }).click()
  await page.getByRole('button', { name: 'Confirmar e ficar pronto' }).click()

  // sozinho e pronto: o mundo nasce e o jogo abre no hub
  await expect(page.getByText('Próximo jogo')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('link', { name: 'Escalação' }).click()
  const campo = page.getByLabel('Campo')
  await expect(campo).toBeVisible()
  const banco = page.getByRole('button', { name: /, banco 1$/ })
  const nome = (await banco.getAttribute('aria-label'))!.split(',')[0]!
  await banco.click()
  await campo.getByRole('button').nth(10).click()
  await expect(campo.getByRole('button', { name: new RegExp(`^${nome},`) })).toBeVisible()
  await expect(page.getByText('Salvando…')).toBeVisible()
  await expect(page.getByText('Salvo.')).toBeVisible({ timeout: 10_000 })
})
