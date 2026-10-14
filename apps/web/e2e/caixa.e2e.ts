import { expect, test, type Page } from '@playwright/test'

// Caixa de entrada: um técnico faz proposta pelo jogador do outro; depois da rodada ela chega na caixa (com o contador
// no menu) e o dono aceita.
test('proposta entre amigos chega na caixa e é respondida', async ({ browser }) => {
  test.setTimeout(120_000)
  const foto = (p: Page, nome: string) => process.env.FOTOS && p.screenshot({ path: `${process.env.FOTOS}/${nome}.png`, fullPage: true })
  const admin = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage()
  await admin.goto('/entrar')
  await admin.getByLabel('Usuário').fill(process.env.ADMIN_USERNAME ?? 'admin')
  await admin.getByLabel('Senha').fill(process.env.ADMIN_PASSWORD ?? 'admin')
  await admin.getByRole('button', { name: 'Entrar' }).click()
  await expect(admin.getByRole('heading', { name: 'Bolasfoot' })).toBeVisible()
  await admin.goto('/admin')
  await admin.getByLabel('Nome').fill(`E2E caixa ${Date.now()}`)
  await admin.getByRole('button', { name: 'Criar jogo' }).click()
  await admin.getByRole('button', { name: 'Gerar convite' }).click()
  const codigo = (await admin.locator('td span').filter({ hasText: /^[A-Z0-9]{4}-[A-Z0-9]{2}$/ }).first().textContent())!
  await admin.getByRole('button', { name: 'Iniciar escolha de times' }).click()
  await expect(admin.getByText('Escolha de times')).toBeVisible()
  await admin.getByRole('link', { name: 'Abrir o jogo' }).click()
  await admin.waitForURL(/\/jogo\/\d+$/)
  const url = admin.url()

  const amigo = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage()
  await amigo.goto(`/convite?codigo=${codigo}`)
  await amigo.getByLabel('Usuário').fill(`amigo${Date.now() % 1e8}`)
  await amigo.getByLabel('Senha').fill('segredo')
  await amigo.getByRole('button', { name: 'Entrar no jogo' }).click()
  await amigo.waitForURL(url)
  for (const [p, nome] of [[admin, 'Bahia'], [amigo, 'Vitória']] as const) {
    await p.getByRole('searchbox', { name: 'Buscar time' }).fill(nome)
    await p.getByRole('button', { name: new RegExp(`^${nome} BA`) }).click()
    await p.getByRole('button', { name: 'Confirmar e ficar pronto' }).click()
  }
  for (const p of [admin, amigo]) await expect(p.getByText('Próximo jogo')).toBeVisible({ timeout: 30_000 })

  // o admin acha um jogador do Vitória e faz a proposta
  await admin.goto(url + '/times')
  await admin.getByRole('searchbox', { name: 'Buscar time' }).fill('Vitória')
  await admin.getByRole('button', { name: /^Vitória$/ }).click()
  const nome = (await admin.locator('section tbody tr').first().locator('td').nth(1).innerText()).trim()
  await admin.goto(url + '/procura')
  await admin.getByRole('searchbox', { name: 'Nome do jogador' }).fill(nome)
  await admin.locator('tbody tr').first().click()
  await expect(admin.getByText(/proposta vai para a caixa dele/)).toBeVisible()
  await admin.getByRole('button', { name: '+1 mi' }).click() // a proposta começa do zero
  await admin.getByRole('button', { name: 'Fazer proposta' }).click()
  await expect(admin.getByText(/^Proposta de R\$/)).toBeVisible()
  await admin.keyboard.press('Escape')

  for (const p of [admin, amigo]) await p.getByRole('button', { name: 'Estou pronto' }).click()
  await expect(amigo.getByLabel(/não lidos/)).toBeVisible({ timeout: 30_000 })
  await amigo.getByRole('link', { name: /Caixa de entrada/ }).click()
  await expect(amigo.getByText(new RegExp(`oferece .* por ${nome}`)).first()).toBeVisible()
  await foto(amigo, 'caixa')
  await amigo.getByRole('button', { name: 'Aceitar' }).first().click()
  await expect(amigo.getByText('Vai aceitar')).toBeVisible()
  await expect(amigo.getByLabel(/não lidos/)).toHaveCount(0)

  await admin.goto(url.replace('/jogo/', '/admin/'))
  await admin.getByLabel('Digite "apagar"').fill('apagar')
  await admin.getByRole('button', { name: 'Apagar jogo' }).click()
  await expect(admin).toHaveURL(/\/admin$/)
})
