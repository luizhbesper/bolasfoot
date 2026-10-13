import { expect, test } from '@playwright/test'

// Gestão e mercado: os pedidos ficam pendentes na rodada e o resultado aparece em "Minhas propostas" depois dela.
test('pede empréstimo, obra e proposta; vê o resultado depois da rodada', async ({ page }) => {
  test.setTimeout(120_000)
  const foto = (nome: string) => process.env.FOTOS && page.screenshot({ path: `${process.env.FOTOS}/${nome}.png`, fullPage: true })
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto('/entrar')
  await page.getByLabel('Usuário').fill(process.env.ADMIN_USERNAME ?? 'admin')
  await page.getByLabel('Senha').fill(process.env.ADMIN_PASSWORD ?? 'admin')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Bolasfoot' })).toBeVisible()
  await page.goto('/admin')
  await page.getByLabel('Nome').fill(`E2E mercado ${Date.now()}`)
  await page.getByRole('button', { name: 'Criar jogo' }).click()
  await page.getByRole('button', { name: 'Iniciar escolha de times' }).click()
  await expect(page.getByText('Escolha de times')).toBeVisible()
  await page.getByRole('link', { name: 'Abrir o jogo' }).click()
  await page.waitForURL(/\/jogo\/\d+$/)
  const url = page.url()
  await page.getByRole('searchbox', { name: 'Buscar time' }).fill('Bahia')
  await page.getByRole('button', { name: /^Bahia BA/ }).click()
  await page.getByRole('button', { name: 'Confirmar e ficar pronto' }).click()
  await expect(page.getByText('Próximo jogo')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('link', { name: 'Finanças' }).click()
  await page.getByRole('button', { name: /^Pegar/ }).click()
  await expect(page.getByText('Pegar R$ 500 mil emprestados')).toBeVisible()
  await foto('financas')

  await page.getByRole('link', { name: 'Estádio' }).click()
  await page.getByLabel('Ampliar Geral').fill('500')
  await page.getByRole('button', { name: 'Começar obra' }).click()
  await expect(page.getByText(/Ampliar o estádio: 500/)).toBeVisible()
  await foto('estadio')

  await page.getByRole('link', { name: 'Procurar jogadores' }).click()
  await page.getByRole('button', { name: 'ATA' }).click()
  await page.getByLabel('Preço máximo').selectOption({ label: 'até R$ 1 mi' })
  await page.locator('tbody tr').first().click()
  await expect(page.getByRole('heading', { name: 'Proposta' })).toBeVisible()
  await foto('procura')
  await page.getByRole('button', { name: 'Fazer proposta' }).click()
  await expect(page.getByText(/^Proposta de R\$/)).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('link', { name: 'Elenco' }).click()
  await expect(page.getByRole('heading', { name: 'Elenco', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Jogador' }).click() // ordena: a tabela já é a do elenco
  await page.locator('tbody tr').last().click()
  await expect(page.getByRole('heading', { name: 'Negociar' })).toBeVisible()
  await foto('elenco-negociar')
  await page.keyboard.press('Escape')

  // a rodada resolve: os pedidos viram resultado
  await page.getByRole('button', { name: 'Estou pronto' }).click()
  await page.goto(url + '/propostas')
  await expect(page.getByText(/^Proposta de R\$/)).toBeVisible({ timeout: 30_000 })
  await foto('propostas')
  for (const r of ['juniores', 'treino', 'leiloes']) {
    await page.goto(url + '/' + r)
    await page.waitForTimeout(1500)
    await foto(r)
  }

  await page.goto(url.replace('/jogo/', '/admin/'))
  await page.getByLabel('Digite "apagar"').fill('apagar')
  await page.getByRole('button', { name: 'Apagar jogo' }).click()
  await expect(page).toHaveURL(/\/admin$/)
})
