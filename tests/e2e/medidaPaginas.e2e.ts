import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Page } from '@playwright/test'
import { criarPeloAssistente, expect, pagina, pastaServidor, test, type AppDeTeste } from './apoio'
import { MC } from './simulado'

// Fase V9 (@desempenho, npm run desempenho:fundo -- medidaPaginas): tempo até a primeira página
// e memória da tela com 2.000 itens instalados de mentira e uma busca gravada grande, no código
// de agora ou no antigo (MEDIDA=antes). Vale para os dois: sem barra de páginas, rola até o fim.

const FASE = process.env.MEDIDA ?? 'depois'
const TABELA = join(__dirname, '..', '..', '.teste', 'resultados-desempenho', 'paginas.md')

async function memoria(a: AppDeTeste, j: Page): Promise<{ mb: number; nos: number }> {
  await j.waitForTimeout(1500) // imagens e o resto da tela assentam
  const mb = await a.app.evaluate(
    ({ app }) =>
      app
        .getAppMetrics()
        .filter((m) => m.type === 'Tab')
        .reduce((t, m) => t + m.memory.workingSetSize, 0) / 1024
  )
  const nos = await j.evaluate(() => document.querySelectorAll('*').length)
  return { mb: Math.round(mb), nos }
}

function anotar(cenario: string, ms: number, m: { mb: number; nos: number }): void {
  mkdirSync(join(TABELA, '..'), { recursive: true })
  if (!existsSync(TABELA))
    writeFileSync(
      TABELA,
      '| Código | Cenário | Até a 1ª página (ms) | Memória da tela (MB) | Elementos na tela |\n| --- | --- | --- | --- | --- |\n'
    )
  appendFileSync(TABELA, `| ${FASE} | ${cenario} | ${ms} | ${m.mb} | ${m.nos} |\n`)
}

test('@desempenho páginas: 2.000 instalados e busca grande', async ({ abrir, simulado }) => {
  test.setTimeout(10 * 60_000)
  const g = JSON.parse(readFileSync(join(__dirname, 'gravadas', 'modrinth-busca.json'), 'utf8'))
  simulado!.responder('api.modrinth.com/v2/search', (q) => {
    const offset = Number(q.get('offset'))
    const limit = Number(q.get('limit'))
    const hits = []
    for (let i = offset; i < Math.min(offset + limit, 5000); i++)
      hits.push({ ...g.hits[0], project_id: `p${i + 1}`, title: `Sodium ${i + 1}` })
    return { json: { hits, offset, limit, total_hits: 5000 } }
  })
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Medida', MC)
  await j.evaluate(() => localStorage.clear()) // tamanho de página padrão (24)

  // 2.000 instalados (aba "Outros": .jar postos à mão).
  const plugins = join(pastaServidor(a.pasta, 'Servidor Medida'), 'plugins')
  mkdirSync(plugins, { recursive: true })
  for (let i = 1; i <= 2000; i++) writeFileSync(join(plugins, `Plugin${i}-1.0.jar`), 'jar falso')
  await pagina(j, 'Mods')
  await j.getByRole('tab', { name: 'Instalados', exact: true }).click()
  await expect(j.getByRole('tab', { name: /^Outros/ })).toBeVisible({ timeout: 120_000 })
  let inicio = Date.now()
  await j.getByRole('tab', { name: /^Outros/ }).click()
  await expect(j.getByText(/^Plugin\d+-1\.0/).first()).toBeVisible({ timeout: 120_000 })
  anotar('Instalados, 2.000 itens', Date.now() - inicio, await memoria(a, j))

  // Busca grande: a primeira página e depois "10 páginas" adiante.
  inicio = Date.now()
  await j.getByRole('tab', { name: 'Explorar', exact: true }).click()
  await expect(j.getByText('Sodium 1', { exact: true })).toBeVisible({ timeout: 60_000 })
  anotar('Busca de 5.000, 1ª página', Date.now() - inicio, await memoria(a, j))
  const barra = j.getByRole('navigation', { name: 'Páginas' })
  inicio = Date.now()
  if (await barra.count()) {
    await j.getByLabel('Ir para a página').fill('10')
    await j.getByRole('button', { name: 'Ir', exact: true }).click()
    await expect(j.getByText('Sodium 217', { exact: true })).toBeVisible()
  } else {
    // Rolagem infinita: rola até ter carregado 240 itens.
    while (!(await j.getByText('Sodium 240', { exact: true }).count())) {
      await j.evaluate(() => {
        const r = document.querySelector('main .overflow-auto')
        if (r) r.scrollTop = r.scrollHeight
      })
      await j.waitForTimeout(150)
    }
  }
  anotar('Busca de 5.000, depois de 10 páginas', Date.now() - inicio, await memoria(a, j))
})
