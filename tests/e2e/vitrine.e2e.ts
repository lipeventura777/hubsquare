import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Locator, type Page } from '@playwright/test'
import { area, criarPeloAssistente, expect, pagina, test, type AppDeTeste } from './apoio'
import { MC } from './simulado'

// Fase V11: modo vitrine no Painel e no Jogar. Esconder e mostrar (botão, Esc e barra lateral),
// lembrar ao reabrir, LIGAR e JOGAR pelo bloco, erro por cima, Tab só no que está visível e a
// barra lateral voltando como estava. Prints em .teste/prints-v11/.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-v11')

const bloco = (j: Page): Locator => j.getByRole('region', { name: /^Vitrine de / })
const larguraDaBarra = (j: Page): Promise<number> =>
  j.locator('nav[aria-label="Seções"]').evaluate((n) => n.getBoundingClientRect().width)
const tituloEscondido = (j: Page): Promise<boolean> =>
  j.locator('.vitrine-titulo').evaluate((e) => e.hasAttribute('data-escondido'))

// Escondido de verdade: dentro de uma área inert (fora do Tab e do leitor de tela).
const dentroDeInert = (l: Locator): Promise<boolean> => l.evaluate((e) => !!e.closest('[inert]'))

// Tab passa só pelo que está à mostra: nada dentro de [inert] nem escondido.
async function tabSoNoVisivel(j: Page): Promise<string[]> {
  const vistos: string[] = []
  for (let n = 0; n < 30; n++) {
    await j.keyboard.press('Tab')
    const r = await j.evaluate(() => {
      const a = document.activeElement as HTMLElement | null
      if (!a || a === document.body) return null
      const caixa = a.getBoundingClientRect()
      return {
        rotulo: a.getAttribute('aria-label') ?? a.textContent?.trim().slice(0, 30) ?? a.tagName,
        inerte: !!a.closest('[inert]'),
        visivel: caixa.width > 0 && caixa.height > 0
      }
    })
    if (!r) continue
    expect(r.inerte, `Tab entrou em algo escondido: ${r.rotulo}`).toBe(false)
    expect(r.visivel, `Tab foi para algo invisível: ${r.rotulo}`).toBe(true)
    vistos.push(r.rotulo)
  }
  return vistos
}

test('vitrine no Painel: esconder, LIGAR no bloco, Tab, Esc, barra lateral e reabrir', async ({
  abrir
}) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Vitrine', MC)
  const larguraAntes = await larguraDaBarra(j)
  expect(larguraAntes).toBeGreaterThan(100) // barra aberta

  await j.getByRole('button', { name: 'Esconder painel' }).click()
  await expect(bloco(j)).toBeVisible()
  await expect(bloco(j).getByRole('heading', { name: 'Servidor Vitrine' })).toBeVisible()
  await expect(bloco(j).getByText('Desligado')).toBeVisible()
  await expect(bloco(j).getByRole('button', { name: 'Fundo' })).toBeVisible()
  await expect.poll(() => tituloEscondido(j)).toBe(true)
  await expect.poll(() => larguraDaBarra(j)).toBeLessThan(80) // recolhida
  // O resto do Painel fica fora do Tab e do leitor de tela.
  expect(await dentroDeInert(j.getByRole('button', { name: 'Mais ações' }))).toBe(true)
  const vistos = await tabSoNoVisivel(j)
  expect(vistos).toContain('Mostrar painel')

  // LIGAR pelo bloco: o estado (ou o erro) aparece no próprio bloco, sem abrir o painel.
  await bloco(j).getByRole('button', { name: 'Ligar', exact: true }).click()
  await expect(
    bloco(j)
      .getByText(/Ligando… \d+:\d\d|Online|Desligado/)
      .or(bloco(j).getByRole('alert'))
      .first()
  ).toBeVisible()
  await expect(bloco(j)).toBeVisible()
  await j.waitForTimeout(400)
  await j.screenshot({ path: join(PRINTS, 'painel-vitrine.png') })

  // Reabrir: a vitrine continua ligada.
  await j.reload()
  await expect(bloco(j)).toBeVisible()

  // Esc traz o painel de volta, e a barra lateral volta como estava.
  await j.keyboard.press('Escape')
  await expect(bloco(j)).toHaveCount(0)
  await expect(j.getByRole('button', { name: 'Esconder painel' })).toBeVisible()
  await expect.poll(() => tituloEscondido(j)).toBe(false)
  await expect.poll(() => larguraDaBarra(j)).toBe(larguraAntes)

  // Pelo botão do bloco e por outra tela da barra lateral.
  await j.getByRole('button', { name: 'Esconder painel' }).click()
  await bloco(j).getByRole('button', { name: 'Mostrar painel' }).click()
  await expect(bloco(j)).toHaveCount(0)
  await j.getByRole('button', { name: 'Esconder painel' }).click()
  await expect(bloco(j)).toBeVisible()
  await pagina(j, 'Opções')
  await pagina(j, 'Painel')
  await expect(bloco(j)).toHaveCount(0)
})

test('vitrine no Jogar: esconder, botão principal no bloco, Esc e lembrar por área', async ({
  abrir
}) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Jogo', MC)
  await area(j, 'PlaySquare')
  await pagina(j, 'Jogar')
  await j.getByRole('button', { name: 'Esconder painel' }).click()
  await expect(bloco(j)).toBeVisible()
  await expect(bloco(j).getByRole('heading', { name: 'Servidor Jogo' })).toBeVisible()
  // Fora do Tab e do leitor de tela (inert).
  expect(await dentroDeInert(j.getByRole('combobox', { name: 'Instalação' }))).toBe(true)
  await tabSoNoVisivel(j)

  // O botão principal (JOGAR, ou INSTALAR/ATUALIZAR com o launcher desligado) funciona pelo bloco.
  await bloco(j)
    .getByRole('button', { name: /^(JOGAR|INSTALAR|ATUALIZAR)/ })
    .first()
    .click()
  await expect(
    bloco(j)
      .getByText(/PREPARANDO|ABRINDO|JOGANDO|INSTALANDO|ATUALIZANDO|Preparando/)
      .or(j.getByRole('dialog'))
      .or(bloco(j).getByRole('alert'))
      .first()
  ).toBeVisible({ timeout: 60_000 })
  // Se o JOGAR abriu um diálogo, o Esc fecha só ele (a vitrine continua).
  if (await j.getByRole('dialog').count()) await j.keyboard.press('Escape')
  await expect(bloco(j)).toBeVisible()

  // Cada área lembra a sua: no ServSquare o Painel continua com o painel.
  await area(j, 'ServSquare')
  await pagina(j, 'Painel')
  await expect(bloco(j)).toHaveCount(0)
  // Voltar ao PlaySquare abre o Jogar de novo, ainda em vitrine (clicar na barra lateral, não).
  await area(j, 'PlaySquare')
  await expect(bloco(j)).toBeVisible()
  await j.keyboard.press('Escape')
  await expect(bloco(j)).toHaveCount(0)
})

// Prints com e sem vitrine nas duas telas: três biomas e uma imagem minha (contraste do bloco:
// a placa de vidro da V1, conferida em tests/contrasteRegras.test.ts).
async function abrirCom(
  abrir: (n?: string, preparar?: (p: string) => void) => Promise<AppDeTeste>,
  nome: string,
  aparencia: object,
  imagem?: Buffer
): Promise<AppDeTeste> {
  return abrir(nome, (p) => {
    const dados = join(p, 'appData', 'ServSquare')
    mkdirSync(join(dados, 'fundos'), { recursive: true })
    if (imagem) {
      const arquivo = `${createHash('sha256').update(imagem).digest('hex')}.png`
      writeFileSync(join(dados, 'fundos', arquivo), imagem)
      aparencia = {
        ...aparencia,
        fundoApp: {
          tipo: 'imagem',
          imagem: arquivo,
          ajuste: {
            enquadrar: 'preencher',
            focoX: 0.5,
            focoY: 0.5,
            desfoque: 0,
            luz: -30,
            particulas: null
          }
        }
      }
    }
    writeFileSync(join(dados, 'aparencia.json'), JSON.stringify(aparencia))
  })
}

const IMAGEM = readFileSync(join(__dirname, '..', '..', 'build', 'icon.png'))
for (const [nome, aparencia, imagem] of [
  ['dia', { bioma: 'dia' }, undefined],
  ['cerejeira', { bioma: 'cerejeira' }, undefined],
  ['deepDark', { bioma: 'deepDark' }, undefined],
  ['imagem', { bioma: 'dia' }, IMAGEM]
] as const) {
  test(`prints da vitrine: ${nome}`, async ({ abrir }) => {
    mkdirSync(PRINTS, { recursive: true })
    const a = await abrirCom(abrir, nome, aparencia, imagem)
    const j = a.janela
    await criarPeloAssistente(j, `Servidor ${nome}`, MC)
    for (const [area_, tela, arquivo] of [
      ['ServSquare', 'Painel', 'painel'],
      ['PlaySquare', 'Jogar', 'jogar']
    ] as const) {
      await area(j, area_)
      await pagina(j, tela)
      await j.waitForTimeout(500)
      await j.screenshot({ path: join(PRINTS, `${nome}-${arquivo}-com-painel.png`) })
      await j.getByRole('button', { name: 'Esconder painel' }).click()
      await expect(bloco(j)).toBeVisible()
      await j.waitForTimeout(600) // a animação termina
      await j.screenshot({ path: join(PRINTS, `${nome}-${arquivo}-vitrine.png`) })
      await bloco(j).getByRole('button', { name: 'Mostrar painel' }).click()
    }
  })
}
