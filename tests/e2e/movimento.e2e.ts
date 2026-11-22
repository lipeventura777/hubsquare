import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Page } from '@playwright/test'
import { area, criarPeloAssistente, expect, pagina, test } from './apoio'
import { MC, type Simulado } from './simulado'

// Fase P8: movimento limpo. A tela nova monta na hora do clique (a antiga só some por cima, sem
// receber cliques), navegar rápido não deixa telas sobrando, o esqueleto do Explorar tem o
// formato dos cards, e com "Reduzir animações" nada se mexe por transform. Prints em
// .teste/prints-p8/.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-p8')

// Busca do Modrinth que demora: dá tempo de ver o esqueleto.
function buscaLenta(s: Simulado): void {
  const g = JSON.parse(readFileSync(join(__dirname, 'gravadas', 'modrinth-busca.json'), 'utf8'))
  s.responder('api.modrinth.com/v2/search', () => ({
    json: { hits: g.hits, offset: 0, limit: 24, total_hits: g.hits.length },
    atraso: 1500
  }))
}

const camadas = (j: Page): Promise<{ total: number; inertes: number }> =>
  j.evaluate(() => {
    const filhos = [...document.querySelectorAll('main.vidro-painel > div')]
    return { total: filhos.length, inertes: filhos.filter((d) => d.hasAttribute('inert')).length }
  })

test('movimento: tela nova na hora, navegação rápida, esqueleto do Explorar e modal', async ({
  abrir,
  simulado
}) => {
  mkdirSync(PRINTS, { recursive: true })
  buscaLenta(simulado!)
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Movimento', MC)

  // A tela nova já está montada logo depois do clique; a antiga fica inerte por cima e some.
  await pagina(j, 'Opções')
  await expect(j.getByRole('button', { name: 'Gerar relatório de erro' })).toBeVisible()
  await pagina(j, 'Jogadores')
  const logo = await camadas(j)
  expect(logo.total - logo.inertes).toBe(1)
  await expect.poll(() => camadas(j)).toEqual({ total: 1, inertes: 0 })

  // Cinco telas bem rápido: no fim sobra só a última, sem nada inerte.
  for (const p of ['Console', 'Mundos', 'Cópias de segurança', 'Jogadores', 'Mods']) {
    await pagina(j, p)
  }
  await expect.poll(() => camadas(j)).toEqual({ total: 1, inertes: 0 })

  // Explorar carregando: esqueleto no formato dos cards (só depois de 150 ms).
  await j.getByRole('tab', { name: 'Explorar', exact: true }).click()
  const esqueleto = j.locator('.esqueleto-atraso').first()
  await expect(esqueleto).toBeVisible()
  await j.waitForTimeout(400)
  await j.screenshot({ path: join(PRINTS, 'explorar-carregando.png') })
  await expect(esqueleto).toHaveCount(0, { timeout: 5000 })
  await j.screenshot({ path: join(PRINTS, 'explorar-carregado.png') })

  // Troca Serv/Play: no meio (60 ms) e no fim.
  await area(j, 'PlaySquare')
  await j.waitForTimeout(60)
  await j.screenshot({ path: join(PRINTS, 'troca-area-meio.png') })
  await j.waitForTimeout(400)
  await j.screenshot({ path: join(PRINTS, 'troca-area-fim.png') })
  await area(j, 'ServSquare')

  // Modal: no meio da entrada (80 ms) e aberto.
  await pagina(j, 'Opções')
  await j.getByRole('button', { name: 'Gerar relatório de erro' }).click()
  await j.waitForTimeout(80)
  await j.screenshot({ path: join(PRINTS, 'modal-entrando.png') })
  await expect(j.getByRole('dialog')).toBeVisible()
  await j.waitForTimeout(400)
  await j.screenshot({ path: join(PRINTS, 'modal-aberto.png') })
})

test('Reduzir animações: trocar de tela e de área não anima transform', async ({ abrir }) => {
  const a = await abrir('reduzido', (p) => {
    const dados = join(p, 'appData', 'HubSquare')
    mkdirSync(dados, { recursive: true })
    writeFileSync(
      join(dados, 'aparencia.json'),
      JSON.stringify({ bioma: 'dia', reduzirAnimacoes: true })
    )
  })
  const j = a.janela
  await expect(j.locator('html')).toHaveAttribute('data-reduzir-animacoes', /.*/)
  await criarPeloAssistente(j, 'Servidor Parado', MC)

  // Logo depois de cada troca, nenhuma animação ou transição rodando mexe em transform.
  const comTransform = (): Promise<string[]> =>
    j.evaluate(() =>
      document.getAnimations().flatMap((an) => {
        if ('transitionProperty' in an) {
          const p = (an as CSSTransition).transitionProperty
          return /transform|translate|scale|rotate/.test(p) ? [`transição de ${p}`] : []
        }
        const quadros = (an.effect as KeyframeEffect | null)?.getKeyframes() ?? []
        return quadros.some((q) => 'transform' in q || 'translate' in q || 'scale' in q)
          ? [`animação ${(an as CSSAnimation).animationName}`]
          : []
      })
    )
  const vistos: string[] = []
  for (const p of ['Opções', 'Jogadores', 'Mundos', 'Mods']) {
    await pagina(j, p)
    vistos.push(...(await comTransform()))
  }
  await area(j, 'PlaySquare')
  vistos.push(...(await comTransform()))
  await area(j, 'ServSquare')
  vistos.push(...(await comTransform()))
  await pagina(j, 'Opções')
  await j.getByRole('button', { name: 'Gerar relatório de erro' }).click()
  vistos.push(...(await comTransform()))
  expect(vistos).toEqual([])
})
