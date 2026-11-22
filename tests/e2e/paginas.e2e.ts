import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Page } from '@playwright/test'
import { criarPeloAssistente, expect, pagina, pastaServidor, test } from './apoio'
import { MC, type Simulado } from './simulado'

// Fase V9: páginas nas listas de mods, sempre com respostas gravadas (nunca as APIs de verdade).
// As páginas saem das respostas gravadas em gravadas/, repetindo o item de exemplo com o número
// de cada posição, pelo offset/limit (Modrinth) ou index/pageSize (CurseForge) de cada pedido.
// Prints em .teste/prints-v9/.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-v9')
const gravada = (nome: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(__dirname, 'gravadas', nome), 'utf8'))

// Busca do Modrinth: total da gravação, itens "Sodium N" na posição N (1 a 1).
function buscaModrinth(
  s: Simulado,
  opcoes: { atraso?: (offset: number) => number; falhar?: Set<number> } = {}
): void {
  const g = gravada('modrinth-busca.json') as {
    hits: Record<string, unknown>[]
    total_hits: number
  }
  s.responder('api.modrinth.com/v2/search', (q) => {
    const offset = Number(q.get('offset'))
    const limit = Number(q.get('limit'))
    if (opcoes.falhar?.has(offset)) {
      opcoes.falhar.delete(offset) // falha uma vez só: o "Tentar de novo" funciona
      return { status: 500, json: { error: 'falha simulada' } }
    }
    const hits = []
    for (let i = offset; i < Math.min(offset + limit, g.total_hits); i++)
      hits.push({
        ...g.hits[0],
        project_id: `p${i + 1}`,
        slug: `sodium-${i + 1}`,
        title: `Sodium ${i + 1}`
      })
    return {
      json: { hits, offset, limit, total_hits: g.total_hits },
      atraso: opcoes.atraso?.(offset)
    }
  })
}

const pedidosDeBusca = (s: Simulado): URLSearchParams[] =>
  s.pedidos
    .filter((p) => p.startsWith('api.modrinth.com/v2/search'))
    .map((p) => new URLSearchParams(p.split('?')[1]))

async function abrirExplorar(j: Page): Promise<void> {
  await pagina(j, 'Mods')
  await j.getByRole('tab', { name: 'Explorar', exact: true }).click()
}

test('Explorar: trocar de página, tamanho salvo, filtro volta para a 1, detalhes, erro e cancelar', async ({
  abrir,
  simulado
}) => {
  mkdirSync(PRINTS, { recursive: true })
  const falhar = new Set<number>()
  buscaModrinth(simulado!, {
    falhar,
    atraso: (offset) => (offset === 7 * 24 ? 1500 : 0) // a página 8 demora
  })
  simulado!.responder('api.modrinth.com/v2/project/', (_q, caminho) =>
    caminho.endsWith('/version')
      ? { json: [] }
      : {
          json: {
            id: caminho.split('/').pop(),
            slug: 'sodium',
            title: 'Sodium',
            description: 'Mod de exemplo',
            body: '',
            icon_url: null,
            project_type: 'mod',
            downloads: 1,
            followers: 1,
            license: { id: 'MIT', name: 'MIT', url: null },
            gallery: [],
            source_url: null,
            wiki_url: null,
            discord_url: null,
            issues_url: null,
            categories: [],
            client_side: 'required',
            server_side: 'unsupported'
          }
        }
  )
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Paginas', MC)
  await abrirExplorar(j)
  const mostrando = j.getByText(/^Mostrando /)

  // Página 1 e só ela foi pedida (24 itens).
  await expect(mostrando).toHaveText('Mostrando 1–24 de 1.234')
  await expect(j.getByText('Sodium 1', { exact: true })).toBeVisible()
  expect(pedidosDeBusca(simulado!).every((q) => q.get('limit') === '24')).toBe(true)
  await j.screenshot({ path: join(PRINTS, 'explorar-pagina-1.png') })

  // Trocar de página: pede a página 2 e mostra os itens dela.
  await j.getByRole('button', { name: 'Página 2', exact: true }).click()
  await expect(mostrando).toHaveText('Mostrando 25–48 de 1.234')
  await expect(j.getByText('Sodium 25', { exact: true })).toBeVisible()
  expect(
    pedidosDeBusca(simulado!).some((q) => q.get('offset') === '24' && q.get('limit') === '24')
  ).toBe(true)

  // Setas do teclado na barra.
  await j.getByRole('button', { name: 'Página 2', exact: true }).focus()
  await j.keyboard.press('ArrowRight')
  await expect(mostrando).toHaveText('Mostrando 49–72 de 1.234')

  // Tamanho da página: volta para a 1 e fica salvo.
  await j.getByLabel('Itens por página').selectOption('48')
  await expect(mostrando).toHaveText('Mostrando 1–48 de 1.234')
  await j.reload()
  await expect(j.getByRole('tab', { name: 'ServSquare' })).toBeVisible()
  await abrirExplorar(j)
  await expect(j.getByLabel('Itens por página')).toHaveValue('48')
  await expect(mostrando).toHaveText('Mostrando 1–48 de 1.234')

  // Mudar um filtro volta para a página 1 e mantém o resto.
  await j.getByRole('button', { name: 'Página 3', exact: true }).click()
  await expect(mostrando).toHaveText('Mostrando 97–144 de 1.234')
  await j.getByText('Só código aberto').click()
  await expect(mostrando).toHaveText('Mostrando 1–48 de 1.234')

  // Voltar dos detalhes: mesma página e mesma posição.
  await j.getByRole('button', { name: 'Página 2', exact: true }).click()
  await expect(mostrando).toHaveText('Mostrando 49–96 de 1.234')
  await j.getByText('Sodium 80', { exact: true }).scrollIntoViewIfNeeded()
  const rolagem = (): Promise<number> =>
    j.evaluate(() => document.querySelector('main .overflow-auto')?.scrollTop ?? 0)
  const antes = await rolagem()
  expect(antes).toBeGreaterThan(0)
  await j.getByText('Sodium 80', { exact: true }).click()
  await j.getByRole('button', { name: /Voltar ao Explorar/ }).click()
  await expect(mostrando).toHaveText('Mostrando 49–96 de 1.234')
  await expect.poll(rolagem).toBe(antes)

  // Uma página que falha mostra o erro na lista; "Tentar de novo" abre a mesma página.
  falhar.add(4 * 48) // página 5 com 48 por página
  await j.getByLabel('Ir para a página').fill('5')
  await j.getByRole('button', { name: 'Ir', exact: true }).click()
  await expect(j.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
  await j.screenshot({ path: join(PRINTS, 'explorar-erro.png') })
  await j.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(mostrando).toHaveText('Mostrando 193–240 de 1.234')
  await expect(j.getByText('Sodium 193', { exact: true })).toBeVisible()

  // Trocar rápido: a página que demora (24 por página, página 8) é cancelada pela seguinte.
  await j.getByLabel('Itens por página').selectOption('24')
  await j.getByLabel('Ir para a página').fill('8')
  await j.getByRole('button', { name: 'Ir', exact: true }).click()
  await j.getByLabel('Ir para a página').fill('9')
  await j.getByRole('button', { name: 'Ir', exact: true }).click()
  await expect(mostrando).toHaveText('Mostrando 193–216 de 1.234')
  await j.waitForTimeout(2000) // a resposta atrasada da página 8 chega e é ignorada
  await expect(mostrando).toHaveText('Mostrando 193–216 de 1.234')
  await expect(j.getByText('Sodium 169', { exact: true })).toHaveCount(0)
  await j.screenshot({ path: join(PRINTS, 'explorar-pagina-9.png') })
  await j.getByRole('navigation', { name: 'Páginas' }).scrollIntoViewIfNeeded()
  await j.screenshot({ path: join(PRINTS, 'explorar-barra-de-paginas.png') })
})

test('CurseForge: com mais de 10.000 resultados, avisa e não pede além do limite', async ({
  abrir,
  simulado
}) => {
  mkdirSync(PRINTS, { recursive: true })
  const g = gravada('curseforge-busca.json') as {
    data: Record<string, unknown>[]
    pagination: { totalCount: number }
  }
  simulado!.responder('api.curseforge.com/v1/mods/search', (q) => {
    const index = Number(q.get('index'))
    const size = Number(q.get('pageSize'))
    const data = Array.from({ length: size }, (_, i) => ({
      ...g.data[0],
      id: 100_000 + index + i,
      name: `JEI ${index + i + 1}`
    }))
    return {
      json: { data, pagination: { index, pageSize: size, totalCount: g.pagination.totalCount } }
    }
  })
  simulado!.responder('api.curseforge.com/v1/categories', () => ({ json: { data: [] } }))
  // Chave de mentira no lugar da chave do build (Fase L1).
  const a = await abrir('app', (p) =>
    writeFileSync(join(p, 'chave-curseforge-teste.txt'), 'chave-de-teste')
  )
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor CF', MC)
  await abrirExplorar(j)
  await j.getByRole('button', { name: 'CurseForge', exact: true }).click()
  await expect(j.getByText('Muitos resultados. Use os filtros para refinar a busca.')).toBeVisible()
  await expect(j.getByText(/^Mostrando /)).toHaveText('Mostrando 1–24 de 10.000')
  await j.screenshot({ path: join(PRINTS, 'curseforge-muitos.png') })
  // A última página alcançável (417) pede só até 10.000.
  await j.getByRole('button', { name: 'Página 417', exact: true }).click()
  await expect(j.getByText(/^Mostrando /)).toHaveText('Mostrando 9.985–10.000 de 10.000')
  const pedidos = simulado!.pedidos
    .filter((p) => p.startsWith('api.curseforge.com/v1/mods/search'))
    .map((p) => new URLSearchParams(p.split('?')[1]))
  for (const q of pedidos)
    expect(Number(q.get('index')) + Number(q.get('pageSize'))).toBeLessThanOrEqual(10_000)
  // A chave nunca aparece na tela.
  expect(await j.locator('body').innerText()).not.toContain('chave-de-teste')
})

test('Instalados: páginas na memória e seleção que vale entre páginas', async ({ abrir }) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Muitos', MC)
  const plugins = join(pastaServidor(a.pasta, 'Servidor Muitos'), 'plugins')
  mkdirSync(plugins, { recursive: true })
  for (let i = 1; i <= 30; i++)
    writeFileSync(join(plugins, `Plugin${String(i).padStart(2, '0')}-1.0.jar`), 'jar falso')
  await pagina(j, 'Mods')
  await j.getByRole('tab', { name: 'Instalados', exact: true }).click()
  // .jar postos à mão (não instalados pelo app) ficam em "Outros".
  await j.getByRole('tab', { name: /^Outros/ }).click()
  await j.getByLabel('Itens por página').selectOption('12')
  const mostrando = j.getByText(/^Mostrando /)
  await expect(mostrando).toHaveText(/^Mostrando 1–12 de \d+$/)

  await j.getByRole('checkbox', { name: /Selecionar Plugin01/ }).check({ force: true })
  await j.getByRole('button', { name: 'Página 2', exact: true }).click()
  await expect(mostrando).toHaveText(/^Mostrando 13–24 de \d+$/)
  await j
    .getByRole('checkbox', { name: /Selecionar Plugin1[3-9]/ })
    .first()
    .check({ force: true })
  await expect(j.getByText('2 selecionados')).toBeVisible()
  await expect(j.getByRole('button', { name: 'Remover selecionados (2)' })).toBeVisible()
  await j.screenshot({ path: join(PRINTS, 'instalados-selecao.png') })

  // A busca vale antes de dividir: só os da busca, de volta na página 1.
  await j
    .getByRole('searchbox')
    .or(j.getByPlaceholder(/Procurar/))
    .first()
    .fill('Plugin2')
  await expect(mostrando).toHaveText(/^Mostrando 1–\d+ de \d+$/)
  await j.getByRole('button', { name: 'Limpar seleção' }).click()
  await expect(j.getByText(/selecionados?$/)).toHaveCount(0)
})
