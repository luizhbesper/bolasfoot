import { expect, test, type Page } from '@playwright/test'

// Plano §6.5 #1 (live): admin cria o jogo e o convite, um amigo entra pelo código em outro navegador, os dois escolhem,
// ficam prontos, a partida toca (com intervalo) e os dois veem os mesmos placares no fim.
test('live: dois técnicos jogam uma rodada e veem o mesmo resultado', async ({ browser }) => {
  test.setTimeout(180_000)
  const admin = await (await browser.newContext()).newPage()
  await admin.goto('/entrar')
  await admin.getByLabel('Usuário').fill(process.env.ADMIN_USERNAME ?? 'admin')
  await admin.getByLabel('Senha').fill(process.env.ADMIN_PASSWORD ?? 'admin')
  await admin.getByRole('button', { name: 'Entrar' }).click()
  await expect(admin.getByRole('heading', { name: 'Bolasfoot' })).toBeVisible()

  await admin.goto('/admin')
  await admin.getByLabel('Nome').fill(`E2E live ${Date.now()}`)
  await admin.getByRole('button', { name: 'Criar jogo' }).click()
  // partida rápida: ~1 s por tempo; resultados ficam na tela tempo bastante para conferir
  await admin.getByLabel('ms por minuto').fill('25')
  await admin.getByLabel('Resultados (s)').fill('120')
  await admin.getByRole('button', { name: 'Salvar' }).click()
  await admin.getByRole('button', { name: 'Gerar convite' }).click()
  const codigo = (await admin.locator('td span').filter({ hasText: /^[A-Z0-9]{4}-[A-Z0-9]{2}$/ }).first().textContent())!
  await admin.getByRole('button', { name: 'Iniciar escolha de times' }).click()
  await admin.getByRole('link', { name: 'Abrir o jogo' }).click()
  await admin.waitForURL(/\/jogo\/\d+$/)
  const url = admin.url()

  const amigo = await (await browser.newContext()).newPage()
  await amigo.goto(`/convite?codigo=${codigo}`)
  await amigo.getByLabel('Usuário').fill(`amigo${Date.now() % 1e8}`)
  await amigo.getByLabel('Senha').fill('segredo')
  await amigo.getByRole('button', { name: 'Entrar no jogo' }).click()
  await amigo.waitForURL(url)

  const escolher = async (p: Page, time: RegExp, busca: string) => {
    await p.getByRole('searchbox', { name: 'Buscar time' }).fill(busca)
    await p.getByRole('button', { name: time }).click()
    await p.getByRole('button', { name: 'Confirmar e ficar pronto' }).click()
  }
  await escolher(admin, /^Bahia BA/, 'Bahia')
  await escolher(amigo, /^Vitória BA/, 'Vitória')

  for (const p of [admin, amigo]) await expect(p.getByText('Próximo jogo')).toBeVisible({ timeout: 30_000 })
  // as primeiras rodadas podem ser só dias sem jogo dos dois: prontos até o apito, que leva os dois para a partida
  await expect(async () => {
    for (const p of [admin, amigo]) {
      const b = p.getByRole('button', { name: 'Estou pronto' })
      if (await b.isVisible()) await b.click()
    }
    for (const p of [admin, amigo]) await expect(p.getByRole('button', { name: 'Voltar para o 2º tempo' })).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 90_000 })
  for (const p of [admin, amigo]) await expect(p.getByRole('heading', { name: 'Intervalo' })).toBeVisible()
  for (const p of [admin, amigo]) await p.getByRole('button', { name: 'Voltar para o 2º tempo' }).click()

  for (const p of [admin, amigo]) await expect(p.getByText('Encerrada')).toBeVisible({ timeout: 30_000 })
  const todos = (p: Page) => p.getByRole('complementary').innerText()
  expect(await todos(admin)).toBe(await todos(amigo))

  // jogo largado rodando faz o agendador resolver rodadas dele nos próximos testes
  await admin.goto(url.replace('/jogo/', '/admin/'))
  await admin.getByLabel('Digite "apagar"').fill('apagar')
  await admin.getByRole('button', { name: 'Apagar jogo' }).click()
  await expect(admin).toHaveURL(/\/admin$/)
})
